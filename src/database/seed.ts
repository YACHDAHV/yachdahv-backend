import "dotenv/config";
import { hash } from "bcryptjs";
import dataSource from "./data-source";
import { Preference, Profile, User, UserRole, VerificationStatus } from "./entities";

const people = [
  { name: "John Doe", email: "admin@yachdahv.test", phone: "+2348000000001", role: UserRole.SUPER_ADMIN, age: 34, gender: "Male", city: "Lagos, Nigeria", interests: ["Reading", "Music"] },
  { name: "Fikayo Adebayo", email: "fikayo@yachdahv.test", phone: "+2348000000002", role: UserRole.MEMBER, age: 27, gender: "Female", city: "Lagos, Nigeria", interests: ["Reading", "Writing", "Running", "Hiking"] },
  { name: "David Okafor", email: "david@yachdahv.test", phone: "+2348000000003", role: UserRole.MEMBER, age: 30, gender: "Male", city: "Lagos, Nigeria", interests: ["Gospel", "Cooking", "Hiking"] },
  { name: "Grace Adeyemi", email: "grace@yachdahv.test", phone: "+2348000000004", role: UserRole.MEMBER, age: 26, gender: "Female", city: "Abuja, Nigeria", interests: ["Reading", "Theatre", "Singing"] },
];

async function seed() {
  await dataSource.initialize();
  const passwordHash = await hash(process.env.SEED_PASSWORD ?? "ChangeMe123!", 12);
  for (const person of people) {
    let user = await dataSource.getRepository(User).findOneBy({ email: person.email });
    user ??= dataSource.getRepository(User).create({
      name: person.name,
      email: person.email,
      phone: person.phone,
      passwordHash,
      role: person.role,
      phoneVerified: true,
      emailVerified: true,
      onboardingCompleted: true,
      identityStatus: VerificationStatus.VERIFIED,
    });
    user = await dataSource.getRepository(User).save(user);
    if (!await dataSource.getRepository(Profile).exists({ where: { userId: user.id } })) {
      await dataSource.getRepository(Profile).save(dataSource.getRepository(Profile).create({
        userId: user.id,
        age: person.age,
        gender: person.gender,
        city: person.city,
        country: "Nigeria",
        church: "Yachdahv Partner Church",
        intention: "Looking to marry within 2 years",
        bio: "Faith, family and meaningful conversations matter to me.",
        interests: person.interests,
        photos: [],
      }));
    }
    if (!await dataSource.getRepository(Preference).exists({ where: { userId: user.id } })) {
      await dataSource.getRepository(Preference).save(dataSource.getRepository(Preference).create({
        userId: user.id,
        minAge: 24,
        maxAge: 38,
        location: "Lagos, Nigeria",
        maxDistanceKm: 50,
        education: "Any",
      }));
    }
  }
  await dataSource.destroy();
}

void seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
