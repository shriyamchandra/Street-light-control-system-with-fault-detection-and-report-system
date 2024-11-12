// src/components/ErrorBoundary.js

import React from "react";
import { Alert, AlertTitle } from "@mui/material";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so next render shows fallback UI
    return { hasError: true, errorInfo: error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service here
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert severity="error">
          <AlertTitle>Something went wrong.</AlertTitle>
          Please try refreshing the page or contact support if the problem persists.
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
