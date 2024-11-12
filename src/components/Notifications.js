// src/components/Notifications.js

import React, { useEffect, useState } from "react";
import { Snackbar, Alert } from "@mui/material";
import PropTypes from "prop-types";

function Notifications({ status, isBackendDown }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("error"); // default to error

  useEffect(() => {
    const activeFaults = getFaults(status, isBackendDown);

    if (activeFaults.length > 0) {
      // Construct message based on active faults
      const faultNames = activeFaults.map((fault) => fault.name).join(", ");
      setMessage(`Active Faults: ${faultNames}`);
      setSeverity("error");
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [status, isBackendDown]);

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={8000}
      onClose={handleClose}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
    >
      <Alert
        onClose={handleClose}
        severity={severity}
        sx={{ width: "100%" }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}

Notifications.propTypes = {
  status: PropTypes.shape({
    faults: PropTypes.object, // Adjust the shape as per your data structure
  }),
  isBackendDown: PropTypes.bool,
};

Notifications.defaultProps = {
  status: null,
  isBackendDown: false,
};

function getFaults(status, isBackendDown) {
  let faults = [];

  if (isBackendDown) {
    faults.push({
      name: "Backend Server",
      description: "Backend server is not responding.",
      type: "Connectivity",
    });
  }

  if (status && status.faults) {
    const faultEntries = status.faults;

    Object.keys(faultEntries).forEach((key) => {
      if (faultEntries[key]) {
        let faultName = "";
        let faultDescription = "";
        let faultType = "Actual"; // Default to Actual

        switch (key) {
          case "PIR_Sensor_Failure":
            faultName = "PIR Sensor";
            faultDescription = "PIR Sensor Failure Detected.";
            break;
          case "IR_Sensor_Failure":
            faultName = "IR Sensor";
            faultDescription = "IR Sensor Failure Detected.";
            break;
          case "TCS_Sensor_Failure":
            faultName = "TCS Sensor";
            faultDescription = "TCS Sensor Failure Detected.";
            break;
          case "I2C_Communication_Failure":
            faultName = "I2C Communication";
            faultDescription = "I2C Communication Failure Detected.";
            break;
          case "Sensor_CrossTalk":
            faultName = "Sensor Cross-Talk";
            faultDescription = "Sensor Cross-Talk Detected.";
            break;
          case "PIR_LED_Failure":
            faultName = "PIR LED";
            faultDescription = "PIR LED Failure Detected.";
            break;
          case "IR_LED_Failure":
            faultName = "IR LED";
            faultDescription = "IR LED Failure Detected.";
            break;
          case "TCS_LED_Failure":
            faultName = "TCS LED";
            faultDescription = "TCS LED Failure Detected.";
            break;
          case "LED1_Failure":
          case "LED2_Failure":
          case "LED3_Failure":
            faultName = key.replace("_Failure", "");
            faultDescription = `${faultName} Failure Detected.`;
            break;
          default:
            faultName = key;
            faultDescription = "Unknown Fault Detected.";
        }

        faults.push({
          name: faultName,
          description: faultDescription,
          type: faultType,
        });
      }
    });
  }

  return faults;
}

export default Notifications;
