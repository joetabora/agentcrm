/**
 * Development seed data for Joe Real Estate OS.
 * All seeded people/properties are labeled with [SEED] where user-visible.
 * Never run against production.
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { hashPassword } from "better-auth/crypto"
import { addDays, addHours, subDays } from "date-fns"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const STAGES = [
  { key: "NEW", name: "New", position: 0 },
  { key: "CONTACTED", name: "Contacted", position: 1 },
  { key: "ENGAGED", name: "Engaged", position: 2 },
  { key: "QUALIFIED", name: "Qualified", position: 3 },
  { key: "APPOINTMENT", name: "Appointment", position: 4 },
  { key: "ACTIVE_CLIENT", name: "Active Client", position: 5 },
  { key: "UNDER_CONTRACT", name: "Under Contract", position: 6 },
  { key: "CLOSED", name: "Closed", position: 7 },
  { key: "PAST_CLIENT", name: "Past Client", position: 8 },
  { key: "NURTURE", name: "Nurture", position: 9 },
  { key: "LOST", name: "Lost", position: 10, isTerminal: true },
]

async function ensurePipelines(organizationId: string) {
  for (const type of ["BUYER", "SELLER"] as const) {
    const existing = await prisma.pipeline.findFirst({
      where: { organizationId, type, isDefault: true },
    })
    if (existing) continue
    await prisma.pipeline.create({
      data: {
        organizationId,
        name: type === "BUYER" ? "Buyer Pipeline" : "Seller Pipeline",
        type,
        isDefault: true,
        stages: {
          create: STAGES.map((s) => ({
            key: s.key,
            name: s.name,
            position: s.position,
            isTerminal: s.isTerminal ?? false,
          })),
        },
      },
    })
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed production")
  }

  console.log("Seeding [SEED] development data…")

  const email = "agent@seed.local"
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const passwordHash = await hashPassword("seedpassword123")
    user = await prisma.user.create({
      data: {
        name: "[SEED] Demo Agent",
        email,
        emailVerified: true,
        accounts: {
          create: {
            accountId: email,
            providerId: "credential",
            password: passwordHash,
          },
        },
      },
    })
  }

  let membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  })

  if (!membership) {
    const org = await prisma.organization.create({
      data: {
        name: "[SEED] Milwaukee Realty",
        slug: `seed-mke-${Date.now()}`,
        memberships: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
    })
    membership = await prisma.membership.findFirstOrThrow({
      where: { userId: user.id, organizationId: org.id },
      include: { organization: true },
    })
  }

  const organizationId = membership.organizationId
  await ensurePipelines(organizationId)

  // Clear prior seed CRM rows for idempotent re-seed of contacts labeled [SEED]
  const seedContacts = await prisma.contact.findMany({
    where: { organizationId, firstName: { startsWith: "[SEED]" } },
    select: { id: true },
  })
  const seedIds = seedContacts.map((c) => c.id)
  if (seedIds.length) {
    await prisma.activity.deleteMany({ where: { organizationId, contactId: { in: seedIds } } })
    await prisma.task.deleteMany({ where: { organizationId, contactId: { in: seedIds } } })
    await prisma.appointment.deleteMany({
      where: { organizationId, contactId: { in: seedIds } },
    })
    await prisma.opportunity.deleteMany({
      where: { organizationId, contactId: { in: seedIds } },
    })
    await prisma.contactRelationship.deleteMany({
      where: {
        OR: [{ fromContactId: { in: seedIds } }, { toContactId: { in: seedIds } }],
      },
    })
    await prisma.contactProperty.deleteMany({ where: { contactId: { in: seedIds } } })
    await prisma.contactFact.deleteMany({ where: { contactId: { in: seedIds } } })
    await prisma.contact.deleteMany({ where: { id: { in: seedIds } } })
  }

  await prisma.property.deleteMany({
    where: { organizationId, line1: { startsWith: "[SEED]" } },
  })

  const contactDefs = [
    { first: "Sarah", last: "Nguyen", type: "BUYER" as const, temp: "HOT" as const, source: "Zillow" },
    { first: "James", last: "Patel", type: "BUYER" as const, temp: "WARM" as const, source: "Referral" },
    { first: "Emily", last: "Brooks", type: "SELLER" as const, temp: "HOT" as const, source: "Open house" },
    { first: "Marcus", last: "Lee", type: "SELLER" as const, temp: "WARM" as const, source: "FSBO" },
    { first: "Olivia", last: "Garcia", type: "PAST_CLIENT" as const, temp: "WARM" as const, source: "Past client" },
    { first: "Daniel", last: "Kim", type: "SPHERE" as const, temp: "COLD" as const, source: "Sphere" },
    { first: "Ava", last: "Johnson", type: "LEAD" as const, temp: "HOT" as const, source: "Website" },
    { first: "Noah", last: "Williams", type: "LEAD" as const, temp: "COLD" as const, source: "Facebook" },
    { first: "Sophia", last: "Martinez", type: "BUYER" as const, temp: "WARM" as const, source: "Realtor.com" },
    { first: "Liam", last: "Anderson", type: "INVESTOR" as const, temp: "WARM" as const, source: "Networking" },
    { first: "Mia", last: "Thomas", type: "VENDOR" as const, temp: null, source: "Preferred vendor" },
    { first: "Ethan", last: "Moore", type: "LENDER" as const, temp: null, source: "Partner" },
    { first: "Isabella", last: "Taylor", type: "ATTORNEY" as const, temp: null, source: "Partner" },
    { first: "Lucas", last: "Jackson", type: "AGENT" as const, temp: null, source: "Co-op" },
    { first: "Charlotte", last: "White", type: "BUYER" as const, temp: "HOT" as const, source: "Google Ads" },
    { first: "Henry", last: "Harris", type: "SELLER" as const, temp: "COLD" as const, source: "Mailer" },
    { first: "Amelia", last: "Clark", type: "SPHERE" as const, temp: "WARM" as const, source: "Church" },
    { first: "Benjamin", last: "Lewis", type: "PAST_CLIENT" as const, temp: "WARM" as const, source: "Past client" },
    { first: "Harper", last: "Robinson", type: "LEAD" as const, temp: "WARM" as const, source: "Open house" },
    { first: "Alexander", last: "Walker", type: "BUYER" as const, temp: "HOT" as const, source: "Referral" },
  ]

  const contacts = []
  for (const [i, def] of contactDefs.entries()) {
    const c = await prisma.contact.create({
      data: {
        organizationId,
        firstName: `[SEED] ${def.first}`,
        lastName: def.last,
        contactType: def.type,
        temperature: def.temp,
        source: def.source,
        lifecycleStage: i % 5 === 0 ? "NEW" : "CONTACTED",
        consentEmail: true,
        consentSms: i % 3 !== 0,
        firstContactAt: subDays(new Date(), 20 - (i % 15)),
        lastContactedAt: i % 4 === 0 ? null : subDays(new Date(), i % 10),
        notesSummary: `[SEED] Demo notes for ${def.first} ${def.last}`,
        emails: {
          create: [
            {
              email: `${def.first.toLowerCase()}.${def.last.toLowerCase()}@seed.local`,
              isPrimary: true,
              label: "primary",
            },
          ],
        },
        phones: {
          create: [
            {
              phone: `414555${String(1000 + i).slice(-4)}`,
              isPrimary: true,
              label: "mobile",
            },
          ],
        },
      },
    })
    contacts.push(c)
  }

  // Relationships: spouse + referred_by
  await prisma.contactRelationship.createMany({
    data: [
      {
        organizationId,
        fromContactId: contacts[0].id,
        toContactId: contacts[1].id,
        relationshipType: "referred_by",
      },
      {
        organizationId,
        fromContactId: contacts[4].id,
        toContactId: contacts[5].id,
        relationshipType: "spouse_of",
      },
      {
        organizationId,
        fromContactId: contacts[17].id,
        toContactId: contacts[19].id,
        relationshipType: "referred_by",
      },
    ],
  })

  await prisma.contactFact.createMany({
    data: [
      {
        organizationId,
        contactId: contacts[0].id,
        statement: "Prefers ranch homes with a fenced yard",
        source: "USER",
        confidence: "HIGH",
        provenance: "USER_ENTERED",
      },
      {
        organizationId,
        contactId: contacts[2].id,
        statement: "Considering selling after kids leave for college",
        source: "CONVERSATION",
        confidence: "MEDIUM",
        provenance: "USER_ENTERED",
      },
    ],
  })

  const cities = [
    "Wauwatosa",
    "Milwaukee",
    "Brookfield",
    "Shorewood",
    "Whitefish Bay",
    "West Allis",
    "Greenfield",
    "Oak Creek",
    "New Berlin",
    "Glendale",
  ]

  const properties = []
  for (let i = 0; i < 10; i++) {
    const p = await prisma.property.create({
      data: {
        organizationId,
        line1: `[SEED] ${100 + i * 11} Maple Ave`,
        city: cities[i],
        state: "WI",
        postalCode: `532${String(10 + i).padStart(2, "0")}`,
        beds: 3 + (i % 3),
        baths: 2 + (i % 2) * 0.5,
        sqft: 1400 + i * 120,
        listPrice: 275000 + i * 25000,
        status: i % 4 === 0 ? "ACTIVE" : i % 4 === 1 ? "PENDING" : "UNKNOWN",
        provenance: "USER_ENTERED",
        description: `[SEED] Demo property in ${cities[i]}`,
        contacts: {
          create: [
            {
              contactId: contacts[i].id,
              role: i % 2 === 0 ? "OWNER" : "BUYER_INTEREST",
            },
          ],
        },
      },
    })
    properties.push(p)
  }

  const buyerPipeline = await prisma.pipeline.findFirstOrThrow({
    where: { organizationId, type: "BUYER", isDefault: true },
    include: { stages: true },
  })
  const sellerPipeline = await prisma.pipeline.findFirstOrThrow({
    where: { organizationId, type: "SELLER", isDefault: true },
    include: { stages: true },
  })

  const stageByKey = (pipeline: typeof buyerPipeline, key: string) =>
    pipeline.stages.find((s) => s.key === key) ?? pipeline.stages[0]

  const oppSpecs = [
    { contact: contacts[0], type: "BUYER" as const, stage: "NEW", title: "Buyer hunt under $400k", temp: "HOT" as const },
    { contact: contacts[1], type: "BUYER" as const, stage: "CONTACTED", title: "Condo search downtown", temp: "WARM" as const },
    { contact: contacts[6], type: "BUYER" as const, stage: "ENGAGED", title: "First-time buyer consult", temp: "HOT" as const },
    { contact: contacts[8], type: "BUYER" as const, stage: "QUALIFIED", title: "Pre-approved to $520k", temp: "WARM" as const },
    { contact: contacts[14], type: "BUYER" as const, stage: "APPOINTMENT", title: "Touring Brookfield this week", temp: "HOT" as const },
    { contact: contacts[19], type: "BUYER" as const, stage: "ACTIVE_CLIENT", title: "Active buyer — Shorewood", temp: "HOT" as const },
    { contact: contacts[2], type: "SELLER" as const, stage: "QUALIFIED", title: "Listing consultation", temp: "HOT" as const },
    { contact: contacts[3], type: "SELLER" as const, stage: "CONTACTED", title: "FSBO conversion", temp: "WARM" as const },
    { contact: contacts[15], type: "SELLER" as const, stage: "NEW", title: "Mailer response — valuation", temp: "COLD" as const },
    { contact: contacts[4], type: "SELLER" as const, stage: "PAST_CLIENT", title: "Past client re-engage", temp: "WARM" as const },
  ]

  for (const spec of oppSpecs) {
    const pipeline = spec.type === "BUYER" ? buyerPipeline : sellerPipeline
    const stage = stageByKey(pipeline, spec.stage)
    const opp = await prisma.opportunity.create({
      data: {
        organizationId,
        contactId: spec.contact.id,
        pipelineId: pipeline.id,
        pipelineStageId: stage.id,
        type: spec.type,
        title: `[SEED] ${spec.title}`,
        temperature: spec.temp,
        source: spec.contact.source,
        assignedToUserId: user.id,
        nextAction: "Follow up",
        nextActionAt: addDays(new Date(), spec.temp === "HOT" ? 0 : 2),
        estimatedValue: 350000,
        firstContactAt: subDays(new Date(), 5),
        lastContactAt: spec.stage === "NEW" ? null : subDays(new Date(), 1),
      },
    })

    await prisma.assignmentEvent.create({
      data: {
        organizationId,
        opportunityId: opp.id,
        toUserId: user.id,
        actorUserId: user.id,
        reason: "[SEED] Initial assignment",
        source: "SYSTEM",
      },
    })

    await prisma.activity.create({
      data: {
        organizationId,
        contactId: spec.contact.id,
        opportunityId: opp.id,
        actorUserId: user.id,
        type: "NOTE",
        subject: "[SEED] Intake note",
        body: `Seeded opportunity for ${spec.contact.firstName} ${spec.contact.lastName}`,
      },
    })
  }

  for (let i = 0; i < 8; i++) {
    await prisma.task.create({
      data: {
        organizationId,
        title: `[SEED] Follow up with ${contacts[i].firstName}`,
        priority: i % 3 === 0 ? "HIGH" : "MEDIUM",
        status: "OPEN",
        dueAt: i % 2 === 0 ? addHours(new Date(), i) : subDays(new Date(), 1),
        contactId: contacts[i].id,
        assigneeUserId: user.id,
        category: "follow_up",
      },
    })
  }

  await prisma.appointment.createMany({
    data: [
      {
        organizationId,
        title: `[SEED] Buyer consult — ${contacts[0].firstName}`,
        startsAt: addHours(new Date(), 3),
        endsAt: addHours(new Date(), 4),
        contactId: contacts[0].id,
        ownerUserId: user.id,
        location: "Office",
      },
      {
        organizationId,
        title: `[SEED] Listing appointment — ${contacts[2].firstName}`,
        startsAt: addDays(new Date(), 1),
        contactId: contacts[2].id,
        propertyId: properties[2].id,
        ownerUserId: user.id,
        location: properties[2].line1,
      },
      {
        organizationId,
        title: `[SEED] Showing — Maple Ave`,
        startsAt: addHours(new Date(), 6),
        contactId: contacts[14].id,
        propertyId: properties[4].id,
        ownerUserId: user.id,
      },
    ],
  })

  console.log("Seed complete.")
  console.log(`  Login: ${email} / seedpassword123`)
  console.log(`  Org: ${membership.organization.name}`)
  console.log(`  Contacts: ${contacts.length}, Properties: ${properties.length}, Opportunities: ${oppSpecs.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
