import { readFile, writeFile } from 'fs/promises';

async function main() {
  const data = await readFile('./indexes.json', 'utf8');
  const indexConfig = JSON.parse(data);
  const indexes = indexConfig.indexes;

  console.log(`Found ${indexes.length} indexes`);

  for (const index of indexes) {
    const fields = new Set();
    const updatedFields = [];
    for (const field of index.fields) {
      const id = `${field.fieldPath}-${field.order}-${field.arrayConfig}`;
      if (!fields.has(id)) {
        fields.add(id);
        updatedFields.push(field);
      } else {
        console.log(`Removed duplicate field: ${JSON.stringify(field)}`);
      }
    }
    index.fields = updatedFields;
  }

  const indexesWithoutDuplicates = [];
  const indexIds = new Set();
  for (const index of indexes) {
    const getFieldId = (field: any) => `${field.fieldPath}-${field.order}-${field.arrayConfig}`;
    const sortedFields = index.fields.sort(function (a: any, b: any) {
      return getFieldId(a).localeCompare(getFieldId(b));
    });

    const indexId = sortedFields.map((field: any) => getFieldId(field)).join('-');

    if (!indexIds.has(indexId)) {
      indexIds.add(indexId);
      indexesWithoutDuplicates.push(index);
    } else {
      console.log(`Removed duplicate index: ${JSON.stringify(index)}`);
    }
  }

  //   console.log(JSON.stringify(indexesWithoutDuplicates, null, 2));
  console.log(`Saving: ${indexesWithoutDuplicates.length} indexes`);

  indexConfig.indexes = indexesWithoutDuplicates;
  await writeFile('./results.json', JSON.stringify(indexConfig, null, 2));
}

void main();
