/**
 * Development seed data for Joe Real Estate OS.
 * Seed records are marked with tag "SEED" and @seed.local emails — no inline [SEED] name prefixes.
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

const FIRST = [
  "Sarah","James","Emily","Marcus","Olivia","Daniel","Ava","Noah","Sophia","Liam",
  "Mia","Ethan","Isabella","Lucas","Charlotte","Henry","Amelia","Benjamin","Harper","Alexander",
  "Grace","Jack","Ella","Owen","Chloe","Caleb","Layla","Nathan","Zoey","Isaac",
  "Nora","Leo","Hazel","Adrian","Violet","Julian","Aurora","Aaron","Stella","Miles",
  "Lucy","Ezra","Paisley","Roman","Ellie","Colton","Naomi","Hunter","Ivy","Parker",
  "Willow","Declan","Bella","Kai","Maya","Ryder","Claire","Silas","Penelope","Theo",
]
const LAST = [
  "Nguyen","Patel","Brooks","Lee","Garcia","Kim","Johnson","Williams","Martinez","Anderson",
  "Thomas","Moore","Taylor","Jackson","White","Harris","Clark","Lewis","Robinson","Walker",
  "Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green",
  "Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Gomez",
  "Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes","Stewart",
  "Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper","Peterson",
]

const CITIES = [
  "Wauwatosa","Milwaukee","Brookfield","Shorewood","Whitefish Bay",
  "West Allis","Greenfield","Oak Creek","New Berlin","Glendale",
  "Waukesha","Mequon","Franklin","Cudahy","South Milwaukee",
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

async function clearSeed(organizationId: string) {
  const seedContacts = await prisma.contact.findMany({
    where: {
      organizationId,
      OR: [
        { firstName: { startsWith: "[SEED]" } },
        { emails: { some: { email: { endsWith: "@seed.local" } } } },
        { tags: { some: { tag: { name: "SEED" } } } },
      ],
    },
    select: { id: true },
  })
  const seedIds = seedContacts.map((c) => c.id)
  if (seedIds.length) {
    await prisma.message.deleteMany({
      where: { organizationId, thread: { contactId: { in: seedIds } } },
    })
    await prisma.communicationThread.deleteMany({
      where: { organizationId, contactId: { in: seedIds } },
    })
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
    await prisma.contactTag.deleteMany({ where: { contactId: { in: seedIds } } })
    await prisma.contact.deleteMany({ where: { id: { in: seedIds } } })
  }

  await prisma.property.deleteMany({
    where: {
      organizationId,
      OR: [{ line1: { startsWith: "[SEED]" } }, { mlsSource: "SEED" }],
    },
  })
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed production")
  }

  console.log("Seeding Harbor development data…")

  const email = "agent@seed.local"
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const passwordHash = await hashPassword("seedpassword123")
    user = await prisma.user.create({
      data: {
        name: "Demo Agent",
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
        name: "Harbor Milwaukee Realty",
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
  await clearSeed(organizationId)

  const seedTag = await prisma.tag.upsert({
    where: { organizationId_name: { organizationId, name: "SEED" } },
    create: { organizationId, name: "SEED", color: "#0d7377" },
    update: {},
  })

  const types = [
    "BUYER","BUYER","SELLER","SELLER","PAST_CLIENT","SPHERE","LEAD","LEAD","BUYER","INVESTOR",
    "VENDOR","LENDER","ATTORNEY","AGENT","BUYER","SELLER","SPHERE","PAST_CLIENT","LEAD","BUYER",
  ] as const
  const temps = ["HOT","WARM","HOT","WARM","WARM","COLD","HOT","COLD","WARM","WARM"] as const
  const sources = [
    "Zillow","Referral","Open house","FSBO","Past client","Sphere","Website","Facebook",
    "Realtor.com","Networking","Preferred vendor","Partner","Partner","Co-op","Google Ads",
  ]

  const contacts = []
  for (let i = 0; i < 60; i++) {
    const first = FIRST[i % FIRST.length]
    const last = LAST[i % LAST.length]
    const type = types[i % types.length]
    const temp = type === "VENDOR" || type === "LENDER" || type === "ATTORNEY" || type === "AGENT"
      ? null
      : temps[i % temps.length]
    const c = await prisma.contact.create({
      data: {
        organizationId,
        firstName: first,
        lastName: `${last}${i >= 20 ? ` ${Math.floor(i / 20) + 1}` : ""}`,
        contactType: type,
        temperature: temp,
        source: sources[i % sources.length],
        lifecycleStage: i % 5 === 0 ? "NEW" : "CONTACTED",
        consentEmail: true,
        consentSms: i % 3 !== 0,
        firstContactAt: subDays(new Date(), 40 - (i % 30)),
        lastContactedAt: i % 4 === 0 ? null : subDays(new Date(), i % 14),
        notesSummary: `${first} is evaluating options in ${CITIES[i % CITIES.length]}.`,
        budgetMin: type === "BUYER" || type === "LEAD" ? 250000 + (i % 5) * 25000 : null,
        budgetMax: type === "BUYER" || type === "LEAD" ? 400000 + (i % 6) * 40000 : null,
        preferences:
          type === "BUYER" || type === "LEAD"
            ? {
                cities: [CITIES[i % CITIES.length], CITIES[(i + 1) % CITIES.length]],
                bedsMin: 2 + (i % 3),
                bathsMin: 2,
              }
            : undefined,
        tags: {
          create: [{ tagId: seedTag.id }],
        },
        emails: {
          create: [
            {
              email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@seed.local`,
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

  const streets = ["Maple Ave","Oak St","Lake Dr","Capitol Dr","Bluemound Rd","North Ave"]
  const properties = []
  for (let i = 0; i < 24; i++) {
    const p = await prisma.property.create({
      data: {
        organizationId,
        line1: `${100 + i * 11} ${streets[i % streets.length]}`,
        city: CITIES[i % CITIES.length],
        state: "WI",
        postalCode: `532${String(10 + (i % 20)).padStart(2, "0")}`,
        beds: 3 + (i % 3),
        baths: 2 + (i % 2) * 0.5,
        sqft: 1400 + i * 80,
        listPrice: 275000 + i * 18000,
        status: i % 5 === 0 ? "PENDING" : "ACTIVE",
        mlsSource: "SEED",
        provenance: "USER_ENTERED",
        listedAt: i % 3 === 0 ? new Date() : subDays(new Date(), i + 2),
        description: `${3 + (i % 3)} bed home in ${CITIES[i % CITIES.length]}.`,
        contacts: {
          create: [
            {
              contactId: contacts[i % contacts.length].id,
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

  const stageKeys = [
    "NEW","CONTACTED","ENGAGED","QUALIFIED","APPOINTMENT","ACTIVE_CLIENT",
    "UNDER_CONTRACT","NURTURE","NEW","CONTACTED",
  ]
  let oppCount = 0
  for (let i = 0; i < 30; i++) {
    const contact = contacts[i]
    const isBuyer = i % 3 !== 0
    const pipeline = isBuyer ? buyerPipeline : sellerPipeline
    const stage = stageByKey(pipeline, stageKeys[i % stageKeys.length])
    const opp = await prisma.opportunity.create({
      data: {
        organizationId,
        contactId: contact.id,
        pipelineId: pipeline.id,
        pipelineStageId: stage.id,
        type: isBuyer ? "BUYER" : "SELLER",
        title: isBuyer
          ? `${contact.firstName} buyer search`
          : `${contact.firstName} listing consult`,
        temperature: temps[i % temps.length],
        source: sources[i % sources.length],
        assignedToUserId: user.id,
        nextAction: "Follow up",
        nextActionAt: addDays(new Date(), i % 4 === 0 ? 0 : 2),
        estimatedValue: 320000 + i * 12000,
        firstContactAt: subDays(new Date(), 8),
        lastContactAt: stage.key === "NEW" ? null : subDays(new Date(), 1),
      },
    })
    oppCount++
    await prisma.activity.create({
      data: {
        organizationId,
        contactId: contact.id,
        opportunityId: opp.id,
        actorUserId: user.id,
        type: "NOTE",
        subject: "Intake note",
        body: `Initial conversation with ${contact.firstName} ${contact.lastName}.`,
      },
    })
  }

  for (let i = 0; i < 16; i++) {
    await prisma.task.create({
      data: {
        organizationId,
        title: `Follow up with ${contacts[i].firstName}`,
        priority: i % 3 === 0 ? "HIGH" : "MEDIUM",
        status: i % 5 === 0 ? "COMPLETED" : "OPEN",
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
        title: `Buyer consult — ${contacts[0].firstName}`,
        startsAt: addHours(new Date(), 3),
        endsAt: addHours(new Date(), 4),
        contactId: contacts[0].id,
        ownerUserId: user.id,
        location: "Office",
      },
      {
        organizationId,
        title: `Listing appointment — ${contacts[2].firstName}`,
        startsAt: addDays(new Date(), 1),
        contactId: contacts[2].id,
        propertyId: properties[2].id,
        ownerUserId: user.id,
        location: properties[2].line1,
      },
      {
        organizationId,
        title: "Showing — Maple Ave",
        startsAt: addHours(new Date(), 6),
        contactId: contacts[14].id,
        propertyId: properties[4].id,
        ownerUserId: user.id,
      },
    ],
  })

  // Message threads for Inbox
  for (let i = 0; i < 6; i++) {
    const thread = await prisma.communicationThread.create({
      data: {
        organizationId,
        contactId: contacts[i].id,
        channel: i % 2 === 0 ? "EMAIL" : "SMS",
        subject: i % 2 === 0 ? `Following up with ${contacts[i].firstName}` : null,
        lastMessageAt: subDays(new Date(), i),
      },
    })
    await prisma.message.createMany({
      data: [
        {
          organizationId,
          threadId: thread.id,
          direction: "OUTBOUND",
          body: `Hi ${contacts[i].firstName} — checking in on your timeline.`,
          status: "SENT",
          providerName: "SEED",
        },
        {
          organizationId,
          threadId: thread.id,
          direction: "INBOUND",
          body: "Thanks — can we talk later this week?",
          status: "RECEIVED",
          providerName: "SEED",
        },
      ],
    })
  }

  console.log("Seed complete.")
  console.log(`  Login: ${email} / seedpassword123`)
  console.log(`  Org: ${membership.organization.name}`)
  console.log(
    `  Contacts: ${contacts.length}, Properties: ${properties.length}, Opportunities: ${oppCount}`,
  )
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
