import { faker } from '@faker-js/faker';
import fs from 'fs';

const n = parseInt(process.env.SEED_SIZE || '500', 10);
const people = Array.from({ length: n }, (_, i) => ({
  id: i + 1,
  email: faker.internet.email().toLowerCase(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  status: faker.datatype.boolean() ? 'active' : 'inactive'
}));

const groups = [
  { id: 101, displayName: 'HQ Employees', members: people.filter(() => Math.random() < 0.5).map(p => p.id) },
  { id: 102, displayName: 'Contractors', members: people.filter(() => Math.random() < 0.2).map(p => p.id) }
];

fs.writeFileSync('db.json', JSON.stringify({ people, groups }, null, 2));
console.log(`Wrote ${people.length} people and ${groups.length} groups to db.json`);