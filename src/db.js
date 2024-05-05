import { openDB, deleteDB } from "idb";

let _db = null;

async function db() {
  if (_db) {
    return _db;
  }
  return _db = await openDB("bucketnotes", 1, {
    upgrade(db) {
      db.createObjectStore("files");
    }
  });
}

export async function setupDatabase() {
  console.debug(`Setting up local database 'bucketnotes'`)
  await db(); 
}

export async function deleteDatabase() {
  return await deleteDB("bucketnotes");
}

export async function clearFiles() {
  return (await db()).clear("files");
}

export async function loadFileFromDatabase(key) {
  return await (await db()).get("files", key);
}

export async function saveFileToDatabase(key, value) {
  value.timestamp = new Date().toISOString()
  return await (await db()).put("files", value, key);
}

export async function deleteFileFromDatabase(key) {
  return await (await db()).delete("files", key);
}

export async function fileKeysFromDatabase(key) {
  return await (await db()).getAllKeys("files");
}
