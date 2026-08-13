import { z } from "zod"
import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import { getStorageProvider } from "@/providers/storage"
import { getEsignProvider } from "@/providers/esign"

export const createDocumentSchema = z.object({
  name: z.string().min(1).max(300),
  contentType: z.string().max(120).optional().nullable(),
  createEnvelope: z.boolean().optional().default(false),
})

export async function createTransactionDocument(
  organizationId: string,
  actorUserId: string,
  transactionId: string,
  input: z.input<typeof createDocumentSchema>,
) {
  const data = createDocumentSchema.parse(input)
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId },
    include: {
      parties: true,
    },
  })
  if (!tx) throw new Error("Transaction not found")

  const storage = getStorageProvider()
  const key = `org/${organizationId}/transactions/${transactionId}/${Date.now()}-${data.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const contentType = data.contentType ?? "application/octet-stream"
  await storage.putObject(key, Buffer.from(""), contentType)

  let esignEnvelopeId: string | null = null
  if (data.createEnvelope) {
    const esign = getEsignProvider()
    const signers = tx.parties
      .filter((p) => p.email)
      .map((p) => ({ email: p.email!, name: p.name }))
    const envelope = await esign.createEnvelope({
      documentName: data.name,
      signers:
        signers.length > 0
          ? signers
          : [{ email: "unsigned@example.com", name: "Placeholder signer" }],
    })
    esignEnvelopeId = envelope.id
  }

  const doc = await prisma.transactionDocument.create({
    data: {
      transactionId,
      name: data.name,
      storageKey: key,
      contentType,
      sizeBytes: 0,
      esignEnvelopeId,
      uploadedByUserId: actorUserId,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "TransactionDocument",
    entityId: doc.id,
    action: "CREATE",
    after: {
      name: doc.name,
      storageKey: doc.storageKey,
      esignEnvelopeId: doc.esignEnvelopeId,
      storageProvider: storage.name,
    },
  })

  return doc
}

export async function getDocumentSignedUrl(
  organizationId: string,
  documentId: string,
) {
  const doc = await prisma.transactionDocument.findFirst({
    where: { id: documentId, transaction: { organizationId } },
  })
  if (!doc) return null
  const storage = getStorageProvider()
  const url = await storage.getSignedUrl(doc.storageKey)
  return { document: doc, url, provider: storage.name }
}
