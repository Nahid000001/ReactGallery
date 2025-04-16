# Azure Cloud Image Gallery

A cloud-native application built using Microsoft Azure services for storing and managing images with metadata.

## Features

- Image upload with metadata support (title, description, tags)
- Image viewing with detailed metadata display
- Image deletion
- Responsive design for all device sizes
- Application monitoring with Azure Application Insights

## Technologies Used

- React.js for the frontend
- Azure Blob Storage for image storage
- Azure Cosmos DB for metadata storage
- Azure Logic Apps for API endpoints
- Azure Application Insights for monitoring and telemetry
- Azure Static Web Apps for hosting
- GitHub Actions for CI/CD

## Setup Instructions

1. Clone the repository
2. Create an Azure Storage Account, Cosmos DB instance, and Logic Apps
3. Update the `.env` file with your Azure credentials and endpoints
4. Run `npm install` to install dependencies
5. Run `npm run dev` to start the development server

## Environment Variables

Create a `.env` file with the following variables:
VITE_STORAGE_ACCOUNT=yourstorageaccount
VITE_STORAGE_CONTAINER=yourcontainername
VITE_STORAGE_SAS=yoursastoken
VITE_APPINSIGHTS_CONNECTION_STRING=your-app-insights-connection-string
VITE_LOGIC_APP_URL=https://your-logic-app-url
VITE_COSMOS_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
VITE_COSMOS_KEY=your-cosmos-key
VITE_COSMOS_DATABASE=your-database-name
VITE_COSMOS_CONTAINER=your-container-name
VITE_APP_INSIGHTS_KEY=your-app-insights-key