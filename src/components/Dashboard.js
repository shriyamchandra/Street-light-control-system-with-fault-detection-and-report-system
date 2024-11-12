// src/components/Dashboard.js

import React from "react";
import { Card, CardContent, Typography, Grid, Button, Chip } from "@mui/material";
import { Error, Brightness5, NightsStay, WbTwilight, Lightbulb } from "@mui/icons-material";
import { Link } from "react-router-dom";
import RedLedImage from "../assets/led-fault.png"; // Ensure you have this image in your assets folder

// Import FaultModeControl component
import FaultModeControl from "./FaultModeControl";

function Dashboard({ status, isBackendDown }) {
  const faults = getFaults(status, isBackendDown);

  return (
    <Card style={{ marginBottom: "20px", padding: "20px" }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Dashboard
        </Typography>
        <Grid container spacing={3}>
          {/* Fault Indicator */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent style={{ textAlign: "center", position: "relative" }}>
                <img
                  src={RedLedImage}
                  alt="Fault Indicator"
                  style={{
                    width: "30px",
                    height: "30px",
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    opacity: faults.length > 0 ? 1 : 0.3,
                  }}
                />
                <Error fontSize="large" color="warning" />
                <Typography variant="h6" style={{ marginTop: "10px" }}>
                  System Faults
                </Typography>
                <Typography variant="h5" color="text.secondary">
                  {faults.length > 0 ? "Faults Detected" : "No Faults"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Mode of Operation */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent style={{ textAlign: "center" }}>
                {getModeIcon(status?.current_duty)}
                <Typography variant="h6" style={{ marginTop: "10px" }}>
                  Mode of Operation
                </Typography>
                <Typography variant="h5" color="text.secondary">
                  {getOperationMode(status?.current_duty) || "N/A"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Fault Mode Control */}
          <Grid item xs={12}>
            <FaultModeControl />
          </Grid>

          {/* LED Status Indicators */}
          {status?.current_duty &&
            Object.keys(status.current_duty).map((led) => (
              <Grid item xs={6} sm={4} key={led}>
                <Card
                  variant="outlined"
                  style={{
                    borderColor:
                      status.faults?.[`${led}_Failure`] ? "red" : "#ddd",
                  }}
                >
                  <CardContent style={{ textAlign: "center" }}>
                    <Lightbulb
                      fontSize="large"
                      style={{ color: getLEDColor(led) }}
                    />
                    <Typography variant="h6" style={{ marginTop: "10px" }}>
                      {led} LED
                    </Typography>
                    <Typography variant="h5" color="text.secondary">
                      {status.current_duty[led] > 0 ? "On" : "Off"}
                    </Typography>
                    {status.faults?.[`${led}_Failure`] && (
                      <Chip
                        label="Fault Detected"
                        color="error"
                        size="small"
                        style={{ marginTop: "5px" }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}

          {/* LED2 Status Indicator */}
          {status?.LED2_state !== undefined && (
            <Grid item xs={6} sm={4} key="LED2">
              <Card
                variant="outlined"
                style={{
                  borderColor:
                    status.faults?.["LED2_Failure"] ? "red" : "#ddd",
                }}
              >
                <CardContent style={{ textAlign: "center" }}>
                  <Lightbulb
                    fontSize="large"
                    style={{ color: getLEDColor("LED2") }}
                  />
                  <Typography variant="h6" style={{ marginTop: "10px" }}>
                    LED2
                  </Typography>
                  <Typography variant="h5" color="text.secondary">
                    {status.LED2_state ? "On" : "Off"}
                  </Typography>
                  {status.faults?.["LED2_Failure"] && (
                    <Chip
                      label="Fault Detected"
                      color="error"
                      size="small"
                      style={{ marginTop: "5px" }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Link to Faults Page if faults are detected */}
        {faults.length > 0 && (
          <Button
            component={Link}
            to="/faults"
            color="secondary"
            variant="contained"
            style={{ marginTop: "20px" }}
          >
            View Faults
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function getOperationMode(currentDuty) {
  if (!currentDuty) return null;

  const tcsDuty = currentDuty.TCS || 0;
  if (tcsDuty > 80) {
    return "Day Mode";
  } else if (tcsDuty < 20) {
    return "Night Mode";
  } else {
    return "Moderate Light Mode";
  }
}

function getModeIcon(currentDuty) {
  const mode = getOperationMode(currentDuty);
  switch (mode) {
    case "Day Mode":
      return <Brightness5 fontSize="large" color="warning" />;
    case "Night Mode":
      return <NightsStay fontSize="large" color="primary" />;
    case "Moderate Light Mode":
      return <WbTwilight fontSize="large" color="info" />;
    default:
      return <Brightness5 fontSize="large" color="disabled" />;
  }
}

function getLEDColor(led) {
  switch (led) {
    case "PIR":
      return "green";
    case "IR":
      return "blue";
    case "TCS":
      return "yellow";
    case "LED1":
      return "purple";
    case "LED2":
      return "orange";
    case "LED3":
      return "pink";
    default:
      return "black";
  }
}

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

export default Dashboard;
