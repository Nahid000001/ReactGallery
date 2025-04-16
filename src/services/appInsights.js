import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const appInsightsKey = import.meta.env.VITE_APP_INSIGHTS_KEY;

// Create instance of Application Insights
export const appInsights = new ApplicationInsights({
  config: {
    connectionString: appInsightsKey,
    /* ...Other Configuration Options... */
  }
});

// Initialize Application Insights
export const initAppInsights = () => {
  if (appInsightsKey) {
    appInsights.loadAppInsights();
    appInsights.trackPageView(); // Track page view when initialized
    console.log("Application Insights initialized");
    return true;
  }
  console.warn("Application Insights key not found");
  return false;
};

// Track custom events
export const trackEvent = (name, properties = {}) => {
  if (appInsightsKey) {
    appInsights.trackEvent({ name }, properties);
  }
};

// Track exceptions
export const trackException = (error) => {
  if (appInsightsKey) {
    appInsights.trackException({ exception: error });
  }
};