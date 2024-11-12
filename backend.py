from fastapi import FastAPI, Body
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import RPi.GPIO as GPIO
import smbus2 as smbus
import time
import threading
import logging

app = FastAPI()

# Configure CORS to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Update with your frontend's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='backend.log',
    filemode='a'
)

# I2C setup for TCS34725
bus = smbus.SMBus(1)  # I2C bus (1 for Raspberry Pi)
TCS34725_ADDRESS = 0x29
COMMAND_BIT = 0x80
ENABLE_REGISTER = 0x00
ENABLE_AEN = 0x02  # RGBC enable
ENABLE_PON = 0x01  # Power on

# Register addresses for color data
CDATAL = 0x14  # Clear (ambient light) channel

# Define pin numbers for PIR, IR sensor, and LEDs
PIR_LED_PIN = 18    # LED for PIR sensor (GPIO 18, Physical Pin 12)
IR_LED_PIN = 22     # LED for IR sensor (GPIO 22, Physical Pin 15)
PIR_PIN = 17        # PIR sensor pin (GPIO 17, Physical Pin 11)
IR_PIN = 27         # IR sensor pin (GPIO 27, Physical Pin 13)
TCS_LED_PIN = 26    # TCS sensor-controlled LED (GPIO 26, Physical Pin 37)
RED_LED_PIN = 12    # Red LED for fault indication (GPIO 12, Physical Pin 32)

# Define pin numbers and physical pins for additional LEDs
ADDITIONAL_LED_PINS = {
    "LED1": {"gpio": 5, "physical": 29},    # Additional LED 1 (GPIO 5, Physical Pin 29)
    "LED2": {"gpio": 6, "detection_gpio": 21, "physical": 31},  # Additional LED 2 (GPIO 6, Physical Pin 31)
    "LED3": {"gpio": 13, "physical": 33},   # Additional LED 3 (GPIO 13, Physical Pin 33)
}

# Fault simulation options
FAULT_MODES = {
    '1': 'Normal Operation',
    '2': 'Simulate PIR Sensor Failure',
    '3': 'Simulate IR Sensor Failure',
    '4': 'Simulate TCS Sensor Failure',
    '5': 'Simulate I2C Communication Failure',
    '6': 'Simulate GPIO Output Failure',
    '7': 'Simulate Power Issues',
    '8': 'Simulate Delayed Response',
    '9': 'Simulate Sensor Cross-Talk',
    '10': 'Simulate LED1 Failure',
    '11': 'Simulate LED2 Failure',
    '12': 'Simulate LED3 Failure',
    # Add more fault modes as needed
}

# Pydantic model for fault mode request
class FaultModeRequest(BaseModel):
    mode: str

# Shared variables and locks
fault_mode = '1'  # Default to Normal Operation
fault_mode_lock = threading.Lock()

last_pir_detection_time = 0
last_ir_detection_time = 0

# Faults dictionary
faults = {
    "PIR_Sensor_Failure": False,
    "IR_Sensor_Failure": False,
    "TCS_Sensor_Failure": False,
    "I2C_Communication_Failure": False,
    "Sensor_CrossTalk": False,
    "PIR_LED_Failure": False,
    "IR_LED_Failure": False,
    "TCS_LED_Failure": False,
    "LED1_Failure": False,
    "LED2_Failure": False,
    "LED3_Failure": False,
    "GPIO_Output_Failure": False,
    "Power_Issues": False,
    "Delayed_Response": False,
}
faults_lock = threading.Lock()

# Manual override flags
manual_override = {
    'LED2': False  # Only LED2 has manual override
}

# Dimming parameters
DIM_STEP = 5        # Duty cycle increment/decrement step
DIM_DELAY = 0.05    # Delay between dimming steps in seconds

# Duty cycle trackers (excluding LED2 as it's not PWM controlled)
current_duty = {
    'PIR': 0,
    'IR': 0,
    'TCS': 0,
    'LED1': 0,
    'LED3': 0
}

# Fade control flags to prevent multiple fade threads (excluding LED2)
fading = {
    'PIR': False,
    'IR': False,
    'TCS': False,
    'LED1': False,
    'LED3': False
}

# LED2 Fault Flag
led2_fault_flag = False
led2_fault_lock = threading.Lock()

# Light intensity thresholds
LOW_LIGHT_THRESHOLD = 1000    # Threshold below which LED brightness is adjusted
HIGH_LIGHT_THRESHOLD = 10000  # Threshold above which LED stays off

# Time to keep the LEDs on after detecting motion or object (in seconds)
LED_ON_TIME = 10

# State lock for thread safety
state_lock = threading.Lock()

# Global variable to store additional PWM instances
additional_pwms = {}

def initialize_gpio():
    global PIR_PWM, IR_PWM, TCS_PWM, additional_pwms
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)

    # Set up sensor input pins with pull-down resistors
    GPIO.setup(PIR_PIN, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
    GPIO.setup(IR_PIN, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

    # Set up LED output pins with initial LOW
    GPIO.setup(PIR_LED_PIN, GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(IR_LED_PIN, GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(TCS_LED_PIN, GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(RED_LED_PIN, GPIO.OUT, initial=GPIO.LOW)

    # Set up power pins and detection pins for additional LEDs
    for led_name, led_info in ADDITIONAL_LED_PINS.items():
        # Set up power pin
        gpio_pin = led_info["gpio"]
        GPIO.setup(gpio_pin, GPIO.OUT, initial=GPIO.LOW)
        # Set up detection pin if it exists
        if "detection_gpio" in led_info:
            detection_pin = led_info["detection_gpio"]
            GPIO.setup(detection_pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

    # Set up PWM for PIR and IR LEDs
    PIR_PWM = GPIO.PWM(PIR_LED_PIN, 1000)  # 1000 Hz frequency
    IR_PWM = GPIO.PWM(IR_LED_PIN, 1000)    # 1000 Hz frequency
    PIR_PWM.start(0)  # Start with LEDs off
    IR_PWM.start(0)

    # Set up PWM on the TCS LED pin with 1000 Hz frequency
    TCS_PWM = GPIO.PWM(TCS_LED_PIN, 1000)
    TCS_PWM.start(0)  # Start PWM with 0% duty cycle (LED off)

    # Initialize the red LED state to off
    GPIO.output(RED_LED_PIN, GPIO.LOW)

    # Set up PWM for additional LEDs (excluding LED2)
    additional_pwms = {}
    for name, led_info in ADDITIONAL_LED_PINS.items():
        if name != "LED2":  # Exclude LED2 from PWM control
            pwm_instance = GPIO.PWM(led_info["gpio"], 1000)
            pwm_instance.start(0)
            additional_pwms[name] = pwm_instance

    logging.info("GPIO and PWM initialized successfully.")

def initialize_tcs34725():
    with fault_mode_lock:
        current_mode = fault_mode
    if current_mode == '4':
        logging.warning("Simulating TCS sensor failure. Skipping initialization.")
        print("Simulating TCS sensor failure. Skipping initialization.")
        return
    try:
        # Power on the TCS34725
        bus.write_byte_data(TCS34725_ADDRESS, COMMAND_BIT | ENABLE_REGISTER, ENABLE_PON)
        time.sleep(0.003)  # Wait for 3ms
        
        # Enable the RGBC function
        bus.write_byte_data(TCS34725_ADDRESS, COMMAND_BIT | ENABLE_REGISTER, ENABLE_PON | ENABLE_AEN)
        time.sleep(0.100)  # Wait for 100ms for integration
        
        # Set Integration Time (ATIME) - Longer integration time for higher sensitivity
        ATIME_REGISTER = 0x01
        ATIME = 0xFF  # Maximum integration time (~700ms)
        bus.write_byte_data(TCS34725_ADDRESS, COMMAND_BIT | ATIME_REGISTER, ATIME)
        
        # Set Gain (CONTROL) - Higher gain for increased sensitivity
        CONTROL_REGISTER = 0x0F
        CONTROL = 0x03  # 60x gain
        bus.write_byte_data(TCS34725_ADDRESS, COMMAND_BIT | CONTROL_REGISTER, CONTROL)
        
        logging.info("TCS34725 color sensor initialized with higher sensitivity settings.")
        print("TCS34725 color sensor initialized with higher sensitivity settings.")
    except Exception as e:
        logging.error(f"Error initializing TCS34725: {e}")
        print(f"Error initializing TCS34725: {e}")
        with faults_lock:
            faults["TCS_Sensor_Failure"] = True
            faults["I2C_Communication_Failure"] = True

def read_clear_data():
    with fault_mode_lock:
        current_mode = fault_mode
    if current_mode == '4':
        # Simulating TCS sensor failure
        logging.warning("Simulating TCS sensor failure. Returning fixed clear value.")
        return 5000  # Fixed value to simulate sensor failure
    if current_mode == '5':
        # Simulating I2C communication failure
        logging.error("Simulating I2C communication failure.")
        raise IOError("I2C communication error")
    try:
        # TCS34725 returns low byte first
        clear_low = bus.read_byte_data(TCS34725_ADDRESS, COMMAND_BIT | CDATAL)
        clear_high = bus.read_byte_data(TCS34725_ADDRESS, COMMAND_BIT | (CDATAL + 1))
        clear = (clear_high << 8) | clear_low
        with faults_lock:
            faults["TCS_Sensor_Failure"] = False
            faults["I2C_Communication_Failure"] = False
        logging.debug(f"Clear value read from TCS34725: {clear}")
        return clear
    except Exception as e:
        logging.error(f"Error reading TCS34725 data: {e}")
        print(f"Error reading TCS34725 data: {e}")
        with faults_lock:
            faults["TCS_Sensor_Failure"] = True
            faults["I2C_Communication_Failure"] = True
        return HIGH_LIGHT_THRESHOLD  # Assume it's bright to turn off LEDs

def map_clear_to_duty_cycle(clear_value, clear_min=LOW_LIGHT_THRESHOLD, clear_max=HIGH_LIGHT_THRESHOLD):
    """Map the clear sensor value to a PWM duty cycle percentage."""
    clear_value = max(clear_min, min(clear_value, clear_max))
    duty_cycle = (clear_max - clear_value) * 100 / (clear_max - clear_min)
    duty_cycle = max(0, min(100, duty_cycle))  # Ensure duty cycle is within [0, 100]
    logging.debug(f"Mapped clear value {clear_value} to duty cycle {duty_cycle}%")
    return duty_cycle

def fade_out(pwm_instance, led_name):
    """Gradually decrease duty cycle to 0."""
    global current_duty, fading
    with faults_lock:
        if faults.get(f"{led_name}_Failure", False):
            logging.error(f"Cannot fade out {led_name} LED due to a detected fault.")
            return
    if fading.get(led_name, False):
        return  # Prevent multiple fade_out threads
    fading[led_name] = True
    logging.debug(f"Starting fade out for {led_name}")
    while current_duty.get(led_name, 0) > 0:
        current_duty[led_name] = max(current_duty.get(led_name, 0) - DIM_STEP, 0)
        pwm_instance.ChangeDutyCycle(current_duty[led_name])
        time.sleep(DIM_DELAY)
    fading[led_name] = False
    logging.debug(f"{led_name} faded out to 0% duty cycle.")

def fade_in(pwm_instance, led_name, target_dc=100):
    """Gradually increase duty cycle to target_dc."""
    global current_duty, fading
    with faults_lock:
        if faults.get(f"{led_name}_Failure", False):
            logging.error(f"Cannot fade in {led_name} LED due to a detected fault.")
            return
    if fading.get(led_name, False):
        return  # Prevent multiple fade_in threads
    fading[led_name] = True
    logging.debug(f"Starting fade in for {led_name} to {target_dc}% duty cycle.")
    while current_duty.get(led_name, 0) < target_dc:
        current_duty[led_name] = min(current_duty.get(led_name, 0) + DIM_STEP, target_dc)
        pwm_instance.ChangeDutyCycle(current_duty[led_name])
        time.sleep(DIM_DELAY)
    fading[led_name] = False
    logging.debug(f"{led_name} faded in to {target_dc}% duty cycle.")

def fade_to_duty_cycle(pwm_instance, led_name, target_dc):
    """Fade to a specific duty cycle smoothly."""
    global current_duty, fading
    with faults_lock:
        if faults.get(f"{led_name}_Failure", False):
            logging.error(f"Cannot change duty cycle of {led_name} LED due to a detected fault.")
            return
    if fading.get(led_name, False):
        return  # Prevent multiple fade threads
    fading[led_name] = True
    logging.debug(f"Starting fade to {target_dc}% duty cycle for {led_name}")
    # Fade in or out based on target
    if target_dc > current_duty.get(led_name, 0):
        while current_duty.get(led_name, 0) < target_dc:
            current_duty[led_name] = min(current_duty.get(led_name, 0) + DIM_STEP, target_dc)
            pwm_instance.ChangeDutyCycle(current_duty[led_name])
            time.sleep(DIM_DELAY)
    elif target_dc < current_duty.get(led_name, 0):
        while current_duty.get(led_name, 0) > target_dc:
            current_duty[led_name] = max(current_duty.get(led_name, 0) - DIM_STEP, target_dc)
            pwm_instance.ChangeDutyCycle(current_duty[led_name])
            time.sleep(DIM_DELAY)
    fading[led_name] = False
    logging.debug(f"{led_name} duty cycle set to {target_dc}%.")

def handle_individual_led_faults(led_faults):
    """Handles faults for individual additional LEDs."""
    for led_name, is_faulty in led_faults.items():
        if is_faulty:
            if led_name in additional_pwms and current_duty[led_name] != 0:
                fade_out(additional_pwms[led_name], led_name)
            # Ensure the LED is off
            if led_name in additional_pwms:
                additional_pwms[led_name].ChangeDutyCycle(0)
                current_duty[led_name] = 0
            logging.error(f"{led_name} LED has a fault and has been turned off.")

def sensor_monitoring_loop():
    global last_pir_detection_time, last_ir_detection_time, led2_fault_flag
    # Initialize duty_cycle attributes
    for key in current_duty.keys():
        current_duty[key] = 0

    # Initialize previous LED2 state
    previous_led2_state = False

    while True:
        # Sensor readings
        with fault_mode_lock:
            current_mode = fault_mode

        # Determine if any faults are active
        faults_active = current_mode != '1'  # '1' is Normal Operation

        # Control the red LED based on fault status
        if faults_active:
            GPIO.output(RED_LED_PIN, GPIO.HIGH)
        else:
            GPIO.output(RED_LED_PIN, GPIO.LOW)

        # Simulate delayed response
        if current_mode == '8':
            delayed_start_time = getattr(sensor_monitoring_loop, 'delayed_start_time', None)
            if delayed_start_time is None:
                sensor_monitoring_loop.delayed_start_time = time.time()
                # Notify once when entering delayed mode
                logging.info("Delayed response mode active. System will respond after 5 seconds.")
                print("Delayed response mode active. System will respond after 5 seconds.")
            elif time.time() - sensor_monitoring_loop.delayed_start_time < 5:
                time.sleep(0.5)
                continue  # Skip this loop iteration
            else:
                sensor_monitoring_loop.delayed_start_time = None  # Reset for next delay
                logging.info("Delayed response mode deactivated.")
                print("Delayed response mode deactivated.")

        # Simulate sensor cross-talk
        if current_mode == '9':
            pir_detected = True  # Simulate PIR detection affecting IR sensor logic
            ir_detected = True
            logging.warning("Simulating sensor cross-talk. Both PIR and IR sensors detected activity.")
            print("Simulating sensor cross-talk. Both PIR and IR sensors detected activity.")
        else:
            # Read PIR sensor
            if current_mode == '2':
                pir_detected = False  # Simulate PIR sensor failure (always False)
            else:
                pir_detected = GPIO.input(PIR_PIN)

            # Read IR sensor
            if current_mode == '3':
                ir_detected = True  # Simulate IR sensor failure (stuck at HIGH)
            else:
                ir_detected = GPIO.input(IR_PIN)

        # Simulate individual LED failures
        led_faults = {
            'LED1': False,
            'LED2': False,
            'LED3': False
        }
        if current_mode in ['10', '11', '12']:
            faulty_led = FAULT_MODES[current_mode].split()[1]  # e.g., 'LED1' from 'Simulate LED1 Failure'
            led_faults[faulty_led] = True
            logging.error(f"Simulating fault in {faulty_led}. It will not light up.")
            print(f"Simulating fault in {faulty_led}. It will not light up.")

        # Simulate GPIO output failure
        gpio_output_enabled = True
        if current_mode == '6':
            gpio_output_enabled = False
            logging.error("Simulating GPIO output failure. LEDs will not update.")
            print("Simulating GPIO output failure. LEDs will not update.")

        # Handle individual LED faults
        handle_individual_led_faults(led_faults)

        # Simulate power issues (flickering LEDs)
        if current_mode == '7':
            # Simulate power issues by randomly turning LEDs on and off
            flicker_duty_cycle = random.choice([0, 50, 100])
            if gpio_output_enabled:
                TCS_PWM.ChangeDutyCycle(flicker_duty_cycle)
                current_duty['TCS'] = flicker_duty_cycle
                for led_name, pwm_instance in additional_pwms.items():
                    if led_name != "LED2" and not led_faults[led_name]:
                        pwm_instance.ChangeDutyCycle(flicker_duty_cycle)
                        current_duty[led_name] = flicker_duty_cycle
            logging.warning("Simulating power issues. LEDs are flickering.")
            print("Simulating power issues. LEDs are flickering.")
        else:
            # Normal light adjustment logic
            try:
                clear = read_clear_data()
            except IOError as e:
                logging.error(f"Error reading from TCS34725 sensor: {e}")
                clear = HIGH_LIGHT_THRESHOLD  # Assume it's bright to turn off LEDs

            if current_mode == '7':
                # Power issues already handled above
                pass
            else:
                # Adjust LED brightness and additional LEDs based on ambient light
                if clear < LOW_LIGHT_THRESHOLD:
                    # Night Mode
                    if pir_detected or not ir_detected:
                        # Turn on additional LEDs
                        for led_name, pwm_instance in additional_pwms.items():
                            if gpio_output_enabled and not led_faults[led_name] and current_duty[led_name] < 100 and not fading[led_name]:
                                threading.Thread(target=fade_in, args=(pwm_instance, led_name, 100)).start()
                        # Turn on LED2 if not in manual override and not faulty
                        with faults_lock:
                            if not manual_override['LED2'] and not faults.get("LED2_Failure", False):
                                GPIO.output(ADDITIONAL_LED_PINS["LED2"]["gpio"], GPIO.HIGH)
                    else:
                        # Turn off additional LEDs
                        for led_name, pwm_instance in additional_pwms.items():
                            if gpio_output_enabled and current_duty[led_name] > 0 and not fading[led_name]:
                                threading.Thread(target=fade_out, args=(pwm_instance, led_name)).start()
                        # Turn off LED2 if not in manual override and not faulty
                        with faults_lock:
                            if not manual_override['LED2'] and not faults.get("LED2_Failure", False):
                                GPIO.output(ADDITIONAL_LED_PINS["LED2"]["gpio"], GPIO.LOW)
                    # Turn on TCS LED
                    if gpio_output_enabled and current_duty['TCS'] < 100 and not fading['TCS']:
                        threading.Thread(target=fade_in, args=(TCS_PWM, 'TCS', 100)).start()
                elif clear > HIGH_LIGHT_THRESHOLD:
                    # Day Mode
                    if gpio_output_enabled:
                        # Turn off TCS LED
                        if current_duty['TCS'] > 0 and not fading['TCS']:
                            threading.Thread(target=fade_out, args=(TCS_PWM, 'TCS')).start()
                        # Turn off additional LEDs
                        for led_name, pwm_instance in additional_pwms.items():
                            if gpio_output_enabled and current_duty[led_name] > 0 and not fading[led_name]:
                                threading.Thread(target=fade_out, args=(pwm_instance, led_name)).start()
                        # Turn off LED2 if not in manual override and not faulty
                        with faults_lock:
                            if not manual_override['LED2'] and not faults.get("LED2_Failure", False):
                                GPIO.output(ADDITIONAL_LED_PINS["LED2"]["gpio"], GPIO.LOW)
                else:
                    # Moderate Light
                    duty_cycle = map_clear_to_duty_cycle(clear)
                    if pir_detected or not ir_detected:
                        # Adjust additional LEDs to mapped duty cycle
                        for led_name, pwm_instance in additional_pwms.items():
                            if gpio_output_enabled and not led_faults[led_name] and current_duty[led_name] < duty_cycle and not fading[led_name]:
                                threading.Thread(target=fade_in, args=(pwm_instance, led_name, duty_cycle)).start()
                        # Turn on LED2 if not in manual override and not faulty
                        with faults_lock:
                            if not manual_override['LED2'] and not faults.get("LED2_Failure", False):
                                GPIO.output(ADDITIONAL_LED_PINS["LED2"]["gpio"], GPIO.HIGH)
                    else:
                        # Turn off additional LEDs
                        for led_name, pwm_instance in additional_pwms.items():
                            if gpio_output_enabled and current_duty[led_name] > 0 and not fading[led_name]:
                                threading.Thread(target=fade_out, args=(pwm_instance, led_name)).start()
                        # Turn off LED2 if not in manual override and not faulty
                        with faults_lock:
                            if not manual_override['LED2'] and not faults.get("LED2_Failure", False):
                                GPIO.output(ADDITIONAL_LED_PINS["LED2"]["gpio"], GPIO.LOW)
                    # Adjust TCS LED to mapped duty cycle
                    if gpio_output_enabled:
                        if duty_cycle > current_duty['TCS'] and not fading['TCS']:
                            threading.Thread(target=fade_in, args=(TCS_PWM, 'TCS', duty_cycle)).start()
                        elif duty_cycle < current_duty['TCS'] and not fading['TCS']:
                            threading.Thread(target=fade_out, args=(TCS_PWM, 'TCS')).start()

        # LED2 Actual Fault Detection
        # Only proceed if not in simulation fault mode for LED2 and not already in a fault state
        with faults_lock:
            if not faults.get("LED2_Failure", False) and current_mode != '11':
                # Check if manual override is active; if so, skip actual fault detection
                if not manual_override['LED2']:
                    # Read GPIO6 (control pin) and GPIO21 (detection pin)
                    led2_control_state = GPIO.input(ADDITIONAL_LED_PINS["LED2"]["gpio"])
                    led2_detection_state = GPIO.input(ADDITIONAL_LED_PINS["LED2"]["detection_gpio"])

                    # Define expected behavior
                    if led2_control_state and not led2_detection_state:
                        # LED2 should be ON (GPIO6 HIGH), but GPIO21 is LOW -> Fault
                        with led2_fault_lock:
                            if not led2_fault_flag:
                                faults["LED2_Failure"] = True
                                led2_fault_flag = True
                                logging.error("Actual Fault Detected: LED2 is not responding as expected.")
                                print("Actual Fault Detected: LED2 is not responding as expected.")
                    elif not led2_control_state and led2_detection_state:
                        # LED2 should be OFF (GPIO6 LOW), but GPIO21 is HIGH -> Fault
                        with led2_fault_lock:
                            if not led2_fault_flag:
                                faults["LED2_Failure"] = True
                                led2_fault_flag = True
                                logging.error("Actual Fault Detected: LED2 is not responding as expected.")
                                print("Actual Fault Detected: LED2 is not responding as expected.")
                    else:
                        # No fault detected; ensure LED2_Failure flag is cleared
                        with led2_fault_lock:
                            if led2_fault_flag:
                                faults["LED2_Failure"] = False
                                led2_fault_flag = False
                                manual_override['LED2'] = False  # Reset manual override
                                logging.info("Actual Fault Resolved: LED2 is responding correctly.")
                                print("Actual Fault Resolved: LED2 is responding correctly.")

        # Sleep briefly before next loop iteration
        time.sleep(1)  # Adjust as needed

@app.on_event("startup")
def startup_event():
    initialize_gpio()
    initialize_tcs34725()
    # Start the sensor monitoring loop in a background thread
    threading.Thread(target=sensor_monitoring_loop, daemon=True).start()
    logging.info("Backend server started and sensor monitoring loop initiated.")

@app.on_event("shutdown")
def shutdown_event():
    # Stop PWM and clean up GPIO settings
    PIR_PWM.stop()
    IR_PWM.stop()
    TCS_PWM.stop()
    for pwm_instance in additional_pwms.values():
        pwm_instance.stop()
    # Turn off the red LED
    GPIO.output(RED_LED_PIN, GPIO.LOW)
    # Turn off LED2
    GPIO.output(ADDITIONAL_LED_PINS["LED2"]["gpio"], GPIO.LOW)
    GPIO.cleanup()
    logging.info("Backend server shutdown and GPIO cleaned up.")

@app.get("/status")
def get_status():
    with fault_mode_lock:
        current_mode = fault_mode

    # Read LED2's detection pin (GPIO 21) to determine its state
    led2_state = False
    try:
        led2_state = GPIO.input(ADDITIONAL_LED_PINS["LED2"]["detection_gpio"]) == GPIO.HIGH
    except Exception as e:
        logging.error(f"Error reading LED2's detection pin: {e}")
        with faults_lock:
            faults["LED2_Failure"] = True

    status = {
        "fault_mode": FAULT_MODES.get(current_mode, "Unknown"),
        "current_duty": current_duty,
        "last_pir_detection_time": last_pir_detection_time,
        "last_ir_detection_time": last_ir_detection_time,
        "LED2_state": led2_state,  # Include LED2's ON/OFF state
        "faults": faults.copy()
    }

    return JSONResponse(status)

@app.post("/set_fault_mode")
def set_fault_mode(request: FaultModeRequest):
    mode = request.mode
    if mode not in FAULT_MODES:
        logging.error(f"Invalid fault mode attempted: {mode}")
        return JSONResponse(status_code=400, content={"error": "Invalid fault mode."})
    
    with fault_mode_lock:
        global fault_mode
        fault_mode = mode

        # Reset all fault states if switching to Normal Operation
        if mode == '1':
            with faults_lock:
                for key in faults:
                    faults[key] = False
            logging.info("Switched to Normal Operation. All faults cleared.")
            print("Switched to Normal Operation. All faults cleared.")
        else:
            # Simulate faults based on the selected mode
            with faults_lock:
                # First, clear all faults
                for key in faults:
                    faults[key] = False
                
                # Then, set the specific fault
                if mode == '2':
                    faults["PIR_Sensor_Failure"] = True
                elif mode == '3':
                    faults["IR_Sensor_Failure"] = True
                elif mode == '4':
                    faults["TCS_Sensor_Failure"] = True
                elif mode == '5':
                    faults["I2C_Communication_Failure"] = True
                elif mode == '6':
                    # Simulate GPIO Output Failure by disabling PWM control
                    faults["GPIO_Output_Failure"] = True
                elif mode == '7':
                    # Simulate Power Issues (handled in sensor loop)
                    faults["Power_Issues"] = True
                elif mode == '8':
                    # Simulate Delayed Response
                    faults["Delayed_Response"] = True
                elif mode == '9':
                    # Simulate Sensor Cross-Talk
                    faults["Sensor_CrossTalk"] = True
                elif mode == '10':
                    faults["LED1_Failure"] = True
                elif mode == '11':
                    faults["LED2_Failure"] = True
                elif mode == '12':
                    faults["LED3_Failure"] = True
                # Add more fault simulations as needed

            logging.info(f"Simulated Fault Mode: {FAULT_MODES[mode]}")
            print(f"Simulated Fault Mode: {FAULT_MODES[mode]}")

    return {"message": FAULT_MODES[mode]}

@app.post("/set_led")
def set_led(request: dict = Body(...)):
    led = request.get('led', '').upper()
    state = request.get('state', False)
    
    if led not in ADDITIONAL_LED_PINS and led not in current_duty and led != "TCS":
        logging.error(f"Invalid LED name attempted: {led}")
        return JSONResponse(status_code=400, content={"error": "Invalid LED name"})

    # Prevent controlling LEDs that are in fault mode
    fault_prevent = False
    with fault_mode_lock:
        if led == "LED1" and fault_mode == '10':
            fault_prevent = True
        elif led == "LED2" and fault_mode == '11':
            fault_prevent = True
        elif led == "LED3" and fault_mode == '12':
            fault_prevent = True
        elif led == "PIR" and fault_mode == '2':
            fault_prevent = True
        elif led == "IR" and fault_mode == '3':
            fault_prevent = True
        elif led == "TCS" and fault_mode == '4':
            fault_prevent = True
        elif fault_mode in ['6', '7', '8', '9'] and led in ['LED1', 'LED2', 'LED3']:
            fault_prevent = True

    if fault_prevent:
        logging.warning(f"Attempted to control {led} while in fault mode.")
        return JSONResponse(status_code=400, content={"error": f"Cannot control {led} in current fault mode."})

    if led == "LED2":
        # Control LED2 directly via GPIO6
        GPIO.output(ADDITIONAL_LED_PINS["LED2"]["gpio"], GPIO.HIGH if state else GPIO.LOW)
        with faults_lock:
            manual_override['LED2'] = True  # Activate manual override
            # Reset LED2 Fault Flag if manual control is restored
            if faults.get("LED2_Failure", False):
                faults["LED2_Failure"] = False
                logging.info("Manual control restored for LED2. Fault flag cleared.")
                print("Manual control restored for LED2. Fault flag cleared.")
        logging.info(f"{led} LED set to {'on' if state else 'off'} via manual control.")
        return {"message": f"{led} LED turned {'on' if state else 'off'} via manual control"}
    else:
        # For PWM-controlled LEDs
        duty_cycle = 100 if state else 0
        pwm_instance = {
            "PIR": PIR_PWM,
            "IR": IR_PWM,
            "TCS": TCS_PWM,
            "LED1": additional_pwms.get("LED1"),
            "LED3": additional_pwms.get("LED3"),
        }.get(led)

        if pwm_instance:
            threading.Thread(target=fade_to_duty_cycle, args=(pwm_instance, led, duty_cycle)).start()
            logging.info(f"{led} LED set to {'on' if state else 'off'}.")
            return {"message": f"{led} LED turned {'on' if state else 'off'}"}
    
    logging.error(f"Failed to set LED: {led}")
    return JSONResponse(status_code=500, content={"error": "Failed to set LED."})

@app.get("/")
def read_root():
    return {"message": "Backend server is running."}
