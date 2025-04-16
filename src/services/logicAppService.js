import axios from 'axios';

const CREATE_ENDPOINT = import.meta.env.VITE_LOGIC_APP_CREATE_URL;
const GET_ALL_ENDPOINT = import.meta.env.VITE_LOGIC_APP_GET_ALL_URL;
const GET_ONE_ENDPOINT = import.meta.env.VITE_LOGIC_APP_GET_ONE_URL;
const UPDATE_ENDPOINT = import.meta.env.VITE_LOGIC_APP_UPDATE_URL;
const DELETE_ENDPOINT = import.meta.env.VITE_LOGIC_APP_DELETE_URL;

// Create an image using Logic App
export const createImage = async (file, metadata) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));
    
    const response = await axios.post(CREATE_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error("Error creating image via Logic App:", error);
    throw error;
  }
};

// Get all images via Logic App
export const getAllImages = async () => {
  try {
    const response = await axios.get(GET_ALL_ENDPOINT);
    return response.data;
  } catch (error) {
    console.error("Error getting all images via Logic App:", error);
    throw error;
  }
};

// Get one image by ID via Logic App
export const getImageById = async (id) => {
  try {
    const response = await axios.get(`${GET_ONE_ENDPOINT}?id=${id}`);
    return response.data;
  } catch (error) {
    console.error("Error getting image via Logic App:", error);
    throw error;
  }
};

// Update image metadata via Logic App
export const updateImage = async (id, metadata) => {
  try {
    const response = await axios.put(UPDATE_ENDPOINT, {
      id,
      metadata
    });
    return response.data;
  } catch (error) {
    console.error("Error updating image via Logic App:", error);
    throw error;
  }
};

// Delete image via Logic App
export const deleteImage = async (id) => {
  try {
    const response = await axios.delete(`${DELETE_ENDPOINT}?id=${id}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting image via Logic App:", error);
    throw error;
  }
};