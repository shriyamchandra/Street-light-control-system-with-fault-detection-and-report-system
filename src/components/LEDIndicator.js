// src/components/LEDIndicator.js

import React from "react";
import { Switch, Typography, Tooltip, Box } from "@mui/material";
import "./LEDIndicator.css";

// Importing Images
import LedGreen from "../assets/led-green.png";
import LedBlue from "../assets/led-blue.jpg";
import LedYellow from "../assets/led-yellow.jpg";
import LedWhite from "../assets/led-white.png";
import LedFault from "../assets/led-fault.png";

function LEDIndicator({ ledName, isOn, toggleLed, isFaulty }) {
  // Map LED names to their corresponding images and colors
  const ledDetails = {
    PIR: { img: LedGreen, color: "#4caf50" },
    IR: { img: LedBlue, color: "#2196f3" },
    TCS: { img: LedYellow, color: "#ffeb3b" },
    LED1: { img: LedWhite, color: "#9c27b0" },
    LED2: { img: LedWhite, color: "#ff9800" },
    LED3: { img: LedWhite, color: "#e91e63" },
  };

  const { img, color } = ledDetails[ledName] || {};
  const displayImg = isFaulty ? LedFault : img; // Show fault image if faulty

  return (
    <Box className="led-indicator-container">
      <Tooltip title={isFaulty ? `${ledName} LED Fault` : `Toggle ${ledName} LED`}>
        <Box
          className={`led-indicator ${isOn ? "active" : ""} ${isFaulty ? "faulty" : ""}`}
          onClick={() => !isFaulty && toggleLed(ledName)} // Disable toggle if faulty
          sx={{
            backgroundColor: isOn
              ? "rgba(255, 255, 255, 0.6)"
              : "rgba(204, 204, 204, 0.6)",
            boxShadow: isOn ? `0 0 20px 5px ${color}` : "none",
            borderRadius: "10px",
            padding: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: isFaulty ? "not-allowed" : "pointer",
            transition: "background-color 0.3s, box-shadow 0.3s, transform 0.3s",
          }}
        >
          <img src={displayImg} alt={`${ledName} LED`} className="led-image" />
          <Switch
            checked={isOn}
            onChange={() => !isFaulty && toggleLed(ledName)}
            color="primary"
            inputProps={{ "aria-label": `${ledName} LED Switch` }}
            disabled={isFaulty}
          />
        </Box>
      </Tooltip>
      <Typography variant="body1" className="led-label">
        {ledName} LED {isFaulty && "(Fault)"}
      </Typography>
    </Box>
  );
}

export default LEDIndicator;
