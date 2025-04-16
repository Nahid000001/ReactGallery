import { CosmosClient } from "@azure/cosmos";

// Cosmos DB configuration
const endpoint = import.meta.env.VITE_COSMOS_ENDPOINT;
const key = import.meta.env.VITE_COSMOS_KEY;
const databaseId = import.meta.env.VITE_COSMOS_DATABASE;
const containerId = import.meta.env.VITE_COSMOS_CONTAINER;

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Create metadata for an image
export const createImageMetadata = async (metadata) => {
  try {
    const { resource: createdItem } = await container.items.create(metadata);
    return createdItem;
  } catch (error) {
    console.error("Error creating metadata:", error);
    throw error;
  }
};

// Get metadata for an image by ID
export const getImageMetadata = async (id) => {
  try {
    const { resource } = await container.item(id, id).read();
    return resource;
  } catch (error) {
    console.error("Error getting metadata:", error);
    throw error;
  }
};

// Get all image metadata
export const getAllImageMetadata = async () => {
  try {
    const querySpec = {
      query: "SELECT * FROM c"
    };
    
    const { resources } = await container.items.query(querySpec).fetchAll();
    return resources;
  } catch (error) {
    console.error("Error getting all metadata:", error);
    throw error;
  }
};

// Update image metadata
export const updateImageMetadata = async (id, updatedMetadata) => {
  try {
    const { resource: updatedItem } = await container.item(id, id).replace(updatedMetadata);
    return updatedItem;
  } catch (error) {
    console.error("Error updating metadata:", error);
    throw error;
  }
};

// Delete image metadata
export const deleteImageMetadata = async (id) => {
  try {
    await container.item(id, id).delete();
  } catch (error) {
    console.error("Error deleting metadata:", error);
    throw error;
  }
};