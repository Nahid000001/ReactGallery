import { useEffect, useState, useCallback } from 'react'
import './App.css'
import { AiFillDelete, AiFillInfoCircle } from 'react-icons/ai'
import { FaFileUpload } from 'react-icons/fa'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Placeholder from './assets/placeholder.jpeg'
import Loading from './components/Loading'
import { BlobServiceClient } from '@azure/storage-blob'
import { ApplicationInsights } from '@microsoft/applicationinsights-web'

// Initialize Application Insights
const appInsights = new ApplicationInsights({
  config: {
    connectionString: import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true,
  }
})
appInsights.loadAppInsights()
appInsights.trackPageView()

const App = () => {
  const [file, setFile] = useState(null)
  const [imageUrls, setImageUrls] = useState([])
  const [loading, setLoading] = useState(false)
  const [imageTitle, setImageTitle] = useState('')
  const [imageDescription, setImageDescription] = useState('')
  const [tags, setTags] = useState('')
  const [error, setError] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [stats, setStats] = useState({ total: 0, totalSize: 0 })

  // Storage account credentials
  const account = import.meta.env.VITE_STORAGE_ACCOUNT
  const sasToken = import.meta.env.VITE_STORAGE_SAS
  const containerName = import.meta.env.VITE_STORAGE_CONTAINER
  const logicAppUrl = import.meta.env.VITE_LOGIC_APP_URL
  
  // Azure clients
  const blobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net/?${sasToken}`)
  const containerClient = blobServiceClient.getContainerClient(containerName)

  // Fetch all images - memoized with useCallback
  const fetchImages = useCallback(async () => {
    if (!account || !sasToken || !containerName) {
      toast.error('Azure Storage credentials missing in environment variables')
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      // Track performance with App Insights
      const fetchStart = Date.now()
      appInsights.trackEvent({ name: "FetchImagesStarted" })
      
      // Get images from Cosmos DB via Logic App
      const metadataResponse = await fetch(`${logicAppUrl}/getall`)
      
      if (metadataResponse.ok) {
        const metadataList = await metadataResponse.json()
        
        // Also get images from Blob Storage for full details
        const blobItems = containerClient.listBlobsFlat()
        const blobsMap = new Map()
        
        for await (const blob of blobItems) {
          const tempBlockBlobClient = containerClient.getBlockBlobClient(blob.name)
          blobsMap.set(blob.name, { 
            name: blob.name, 
            url: tempBlockBlobClient.url,
            metadata: blob.metadata || {},
            properties: blob.properties
          })
        }
        
        // Merge metadata from Cosmos DB with Blob information
        const urls = metadataList.map(item => {
          const blobName = item.blobName || item.name
          const blobInfo = blobsMap.get(blobName) || {}
          
          return {
            id: item.id,
            name: blobName,
            url: blobInfo.url || item.url,
            title: item.title || blobInfo.metadata?.title || getImageNameWithoutExtension(blobName),
            description: item.description || '',
            tags: item.tags || [],
            uploadedAt: item.timestamp || item.uploadedAt || blobInfo.properties?.createdOn,
            size: item.size || blobInfo.properties?.contentLength || 0,
            contentType: item.contentType || blobInfo.properties?.contentType || 'image/jpeg'
          }
        })
        
        // Sort by newest first
        urls.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        
        setImageUrls(urls)
        
        // Update statistics
        const totalSize = urls.reduce((acc, item) => acc + (parseInt(item.size) || 0), 0)
        setStats({
          total: urls.length,
          totalSize: formatFileSize(totalSize)
        })
        
        // Track fetch completion in App Insights
        const fetchDuration = Date.now() - fetchStart
        appInsights.trackMetric({ name: "FetchImagesDuration", average: fetchDuration })
        appInsights.trackEvent({ 
          name: "FetchImagesCompleted", 
          properties: { 
            count: urls.length,
            duration: fetchDuration
          }
        })
      } else {
        throw new Error(`Failed to fetch metadata: ${metadataResponse.statusText}`)
      }
    } catch (error) {
      console.error('Error fetching images:', error)
      setError('Failed to fetch images. Please try again.')
      appInsights.trackException({ exception: error })
      
      // Fallback to blob storage only
      try {
        const blobItems = containerClient.listBlobsFlat()
        const urls = []
        
        for await (const blob of blobItems) {
          const tempBlockBlobClient = containerClient.getBlockBlobClient(blob.name)
          urls.push({ 
            name: blob.name, 
            url: tempBlockBlobClient.url,
            title: blob.metadata?.title || getImageNameWithoutExtension(blob.name),
            metadata: blob.metadata || {},
            size: blob.properties?.contentLength || 0
          })
        }
        
        urls.sort((a, b) => {
          const timeA = a.name.split('-')[0]
          const timeB = b.name.split('-')[0]
          return timeB - timeA
        })
        
        setImageUrls(urls)
        
        // Update statistics for fallback
        const totalSize = urls.reduce((acc, item) => acc + (parseInt(item.size) || 0), 0)
        setStats({
          total: urls.length,
          totalSize: formatFileSize(totalSize)
        })
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError)
        appInsights.trackException({ exception: fallbackError })
      }
    } finally {
      setLoading(false)
    }
  }, [account, sasToken, containerName, logicAppUrl])

  // Upload image and send metadata
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!file) {
      toast.warning('Please select an image to upload')
      return
    }
    
    if (!imageTitle.trim()) {
      toast.warning('Please enter a title for your image')
      return
    }
    
    if (!account || !sasToken || !containerName) {
      toast.error('Azure Storage credentials missing')
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      // Create a unique blob name with timestamp
      const blobName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
      const blobClient = containerClient.getBlockBlobClient(blobName)
      
      // Start tracking upload with App Insights
      const uploadStart = Date.now()
      appInsights.trackEvent({ 
        name: "UploadStarted", 
        properties: { 
          fileName: file.name, 
          fileSize: file.size,
          fileType: file.type,
          title: imageTitle
        }
      })

      // Prepare metadata for blob storage
      const blobMetadata = {
        title: imageTitle,
        uploadedAt: new Date().toISOString()
      }
      
      if (imageDescription) {
        blobMetadata.description = imageDescription
      }
      
      if (tags) {
        blobMetadata.tags = tags
      }

      // Upload image to Blob Storage with metadata
      await blobClient.uploadData(file, {
        blobHTTPHeaders: { blobContentType: file.type },
        metadata: blobMetadata
      })
      
      // Track upload completion and duration
      const uploadDuration = Date.now() - uploadStart
      appInsights.trackEvent({ 
        name: "UploadCompleted", 
        properties: { 
          fileName: file.name, 
          duration: uploadDuration,
          size: file.size
        }
      })

      // Prepare tags as array
      const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : []

      // Send metadata to Azure Logic App (connected to Cosmos DB)
      const cosmosResponse = await fetch(logicAppUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: `image-${Date.now()}`,
          blobName: blobName,
          title: imageTitle,
          description: imageDescription || '',
          tags: tagArray,
          url: blobClient.url,
          contentType: file.type,
          size: file.size,
          timestamp: new Date().toISOString()
        })
      })
      
      if (!cosmosResponse.ok) {
        console.warn('Metadata saved to blob but Cosmos DB storage failed')
        appInsights.trackEvent({ 
          name: "CosmosDBSaveFailed", 
          properties: { statusCode: cosmosResponse.status }
        })
      }

      toast.success('Image uploaded successfully!')
      setFile(null)
      setImageTitle('')
      setImageDescription('')
      setTags('')
      await fetchImages()
    } catch (error) {
      console.error('Error uploading image:', error)
      setError('Failed to upload image. Please try again.')
      toast.error('Upload failed: ' + error.message)
      appInsights.trackException({ exception: error })
    } finally {
      setLoading(false)
    }
  }

  // Delete image
  const handleDelete = async (blobName) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return
    }
    
    if (!account || !sasToken || !containerName) {
      toast.error('Azure Storage credentials missing')
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      // Track deletion with App Insights
      appInsights.trackEvent({ name: "ImageDeleteStarted", properties: { blobName } })
      
      const blobClient = containerClient.getBlockBlobClient(blobName)
      await blobClient.delete()
      
      // Also delete metadata from Cosmos DB via Logic App
      const deleteResponse = await fetch(`${logicAppUrl}/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ blobName })
      })
      
      if (!deleteResponse.ok) {
        console.warn('Blob deleted but metadata deletion may have failed')
        appInsights.trackEvent({ 
          name: "MetadataDeleteFailed", 
          properties: { statusCode: deleteResponse.status }
        })
      }
      
      appInsights.trackEvent({ name: "ImageDeleteCompleted" })
      toast.success('Image deleted successfully')
      await fetchImages()
    } catch (error) {
      console.error('Error deleting image:', error)
      setError('Failed to delete image. Please try again.')
      toast.error('Delete failed: ' + error.message)
      appInsights.trackException({ exception: error })
    } finally {
      setLoading(false)
    }
  }
  
  // View image details
  const handleViewDetails = (image) => {
    setSelectedImage(image)
    setIsModalOpen(true)
    appInsights.trackEvent({ name: "ViewImageDetails", properties: { imageId: image.id || image.name } })
  }
  
  // Close modal
  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedImage(null)
  }
  
  // Helper: Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Initial fetch
  useEffect(() => {
    fetchImages()
    
    // Track page view with App Insights
    appInsights.trackPageView({ name: "Image Gallery" })
    
    return () => {
      // Clean up any resources if needed
    }
  }, [fetchImages])

  // Helper: remove file extension
  const getImageNameWithoutExtension = (filename) => {
    const dotIndex = filename.lastIndexOf('.')
    return dotIndex !== -1 ? filename.slice(0, dotIndex) : filename
  }
  
  // Format date for display
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString()
    } catch (e) {
      return 'Unknown date'
    }
  }

  return (
    <div className="container">
      {loading && <Loading />}
      <ToastContainer position="top-right" autoClose={3000} />
      
      <header className="app-header">
        <h1>📸 Welcome to My Awesome React Gallery 📸</h1>
        <div className="gallery-stats">
          <span>Total Images: {stats.total}</span>
          <span>Total Size: {stats.totalSize}</span>
        </div>
      </header>
      <hr />
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="row-form">
        <form className='upload-form' onSubmit={handleSubmit}>
          <div className='upload-form_display'>
            {file
              ? <img className="displayImg" src={URL.createObjectURL(file)} alt="selected" />
              : <img className="displayImg" src={Placeholder} alt="placeholder" />
            }
          </div>
          
          <div className='upload-form_inputs'>
            <input
              type="text"
              placeholder="Enter image title (required)"
              value={imageTitle}
              onChange={(e) => setImageTitle(e.target.value)}
              className="title-input"
              required
            />
            
            <textarea
              placeholder="Image description (optional)"
              value={imageDescription}
              onChange={(e) => setImageDescription(e.target.value)}
              className="description-input"
            />
            
            <input
              type="text"
              placeholder="Tags (comma separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="tags-input"
            />
            
            <label htmlFor="fileInput" className="file-input-label">
              <FaFileUpload /> Select Image
            </label>
            <input
              type="file"
              style={{ display: "none" }}
              id="fileInput"
              accept="image/*"
              onChange={(e) => {
                const selectedFile = e.target.files[0];
                if (selectedFile) {
                  if (selectedFile.size > 5 * 1024 * 1024) {
                    toast.error('File size exceeds 5MB limit');
                    appInsights.trackEvent({ name: "FileSizeExceeded", properties: { size: selectedFile.size } });
                    return;
                  }
                  setFile(selectedFile);
                  if (!imageTitle) {
                    setImageTitle(getImageNameWithoutExtension(selectedFile.name));
                  }
                  appInsights.trackEvent({ name: "FileSelected", properties: { type: selectedFile.type, size: selectedFile.size } });
                }
              }}
            />
            
            <button type="submit" className="upload-button" disabled={loading}>
              Upload Image
            </button>
          </div>
        </form>
      </div>

      <div className="row-display">
        {imageUrls.length === 0 ? (
          <h3>😐 No Images Found 😐</h3>
        ) : (
          imageUrls.map((image, index) => (
            <div key={index} className="card">
              <img 
                src={image.url} 
                alt={image.title || getImageNameWithoutExtension(image.name)} 
                loading="lazy" 
                onClick={() => handleViewDetails(image)}
              />
              <h3>{image.title || getImageNameWithoutExtension(image.name)}</h3>
              <div className="card-actions">
                <button className="btn-info" onClick={() => handleViewDetails(image)} title="View details">
                  <AiFillInfoCircle />
                </button>
                <button className="btn-delete" onClick={() => handleDelete(image.name)} title="Delete image">
                  <AiFillDelete />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Image Details Modal */}
      {isModalOpen && selectedImage && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{selectedImage.title}</h2>
            <img src={selectedImage.url} alt={selectedImage.title} />
            
            <div className="image-details">
              {selectedImage.description && (
                <p><strong>Description:</strong> {selectedImage.description}</p>
              )}
              
              {selectedImage.tags && selectedImage.tags.length > 0 && (
                <p>
                  <strong>Tags:</strong> {
                    Array.isArray(selectedImage.tags) 
                      ? selectedImage.tags.join(', ') 
                      : selectedImage.tags
                  }
                </p>
              )}
              
              <p><strong>Uploaded:</strong> {formatDate(selectedImage.uploadedAt)}</p>
              <p><strong>Size:</strong> {formatFileSize(selectedImage.size)}</p>
              <p><strong>Type:</strong> {selectedImage.contentType}</p>
            </div>
            
            <button onClick={closeModal} className="modal-close">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App