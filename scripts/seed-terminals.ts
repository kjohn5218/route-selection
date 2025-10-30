import prisma from '../src/utils/database.js';

const terminals = [
  { code: 'ABQ', name: 'Albuquerque Terminal' },
  { code: 'BIL', name: 'Billings Terminal' },
  { code: 'BIS', name: 'Bismarck Terminal' },
  { code: 'BOI', name: 'Boise Terminal' },
  { code: 'BTM', name: 'Butte Terminal' },
  { code: 'BYI', name: 'Burley Terminal' },
  { code: 'BZN', name: 'Bozeman Terminal' },
  { code: 'CPR', name: 'Casper Terminal' },
  { code: 'DEN', name: 'Denver Terminal' },
  { code: 'DFW', name: 'Dallas/Fort Worth Terminal' },
  { code: 'DIK', name: 'Dickinson Terminal' },
  { code: 'DRO', name: 'Durango Terminal' },
  { code: 'DSM', name: 'Des Moines Terminal' },
  { code: 'DUL', name: 'Duluth Terminal' },
  { code: 'ELP', name: 'El Paso Terminal' },
  { code: 'FAR', name: 'Fargo Terminal' },
  { code: 'GAR', name: 'Garden City Terminal' },
  { code: 'GFK', name: 'Grand Forks Terminal' },
  { code: 'GJT', name: 'Grand Junction Terminal' },
  { code: 'GRI', name: 'Grand Island Terminal' },
  { code: 'GTF', name: 'Great Falls Terminal' },
  { code: 'HAY', name: 'Hays Terminal' },
  { code: 'HLN', name: 'Helena Terminal' },
  { code: 'HOU', name: 'Houston Terminal' },
  { code: 'IDA', name: 'Idaho Falls Terminal' },
  { code: 'KCY', name: 'Kansas City Terminal' },
  { code: 'KSP', name: 'Kalispell Terminal' },
  { code: 'LAS', name: 'Las Vegas Terminal' },
  { code: 'MOT', name: 'Minot Terminal' },
  { code: 'MSO', name: 'Missoula Terminal' },
  { code: 'MSP', name: 'Minneapolis/St. Paul Terminal' },
  { code: 'NCS', name: 'Newcastle Terminal' },
  { code: 'NPL', name: 'North Platte Terminal' },
  { code: 'OMA', name: 'Omaha Terminal' },
  { code: 'PHX', name: 'Phoenix Terminal' },
  { code: 'PIE', name: 'Pierre Terminal' },
  { code: 'PUB', name: 'Pueblo Terminal' },
  { code: 'RNO', name: 'Reno Terminal' },
  { code: 'ROW', name: 'Roswell Terminal' },
  { code: 'RPC', name: 'Rapid City Terminal' },
  { code: 'SAL', name: 'Salina Terminal' },
  { code: 'SAT', name: 'San Antonio Terminal' },
  { code: 'SCB', name: 'Scottsbluff Terminal' },
  { code: 'SGF', name: 'Springfield Terminal' },
  { code: 'SGU', name: 'St. George Terminal' },
  { code: 'SLC', name: 'Salt Lake City Terminal' },
  { code: 'STL', name: 'St. Louis Terminal' },
  { code: 'SXF', name: 'Sioux Falls Terminal' },
  { code: 'TUS', name: 'Tucson Terminal' },
  { code: 'WIC', name: 'Wichita Terminal' },
  { code: 'WTT', name: 'Williston Terminal' },
];

async function seedTerminals() {
  console.log('🌱 Seeding terminals...\n');

  try {
    // Create terminals
    for (const terminal of terminals) {
      const existing = await prisma.terminal.findUnique({
        where: { code: terminal.code },
      });

      if (!existing) {
        await prisma.terminal.create({
          data: terminal,
        });
        console.log(`✅ Created terminal: ${terminal.code} - ${terminal.name}`);
      } else {
        console.log(`⏭️  Terminal already exists: ${terminal.code}`);
      }
    }

    console.log(`\n✅ Successfully seeded ${terminals.length} terminals`);
  } catch (error) {
    console.error('❌ Error seeding terminals:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTerminals();