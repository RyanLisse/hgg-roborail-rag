# RoboRail Error Codes Reference

## 🎯 Overview

This comprehensive reference guide provides detailed information about RoboRail error codes, their meanings, and recommended corrective actions. Error codes are displayed on the HMI panel and help diagnose system issues quickly.

## 🚨 Critical Safety Codes (E000 Series)

### E001 - Emergency Stop Activated
**Description**: Emergency stop button has been pressed or safety circuit interrupted
**Immediate Action**: 
1. Verify area is safe
2. Identify cause of e-stop activation
3. Address any safety concerns
4. Pull out e-stop button to reset
5. Restart system through normal startup procedure

**Common Causes**:
- Intentional e-stop button press
- Safety guard opened during operation
- Light curtain interruption
- External safety device activation

### E002 - Safety Interlock Open
**Description**: One or more safety interlocks are not properly engaged
**Corrective Actions**:
1. Check all safety guards are closed and latched
2. Verify light curtains are aligned and unobstructed
3. Inspect safety switch operation
4. Ensure all personnel are clear of danger zones

**Related Components**: Safety guards, interlock switches, light curtains

### E003 - Servo Drive Safety Fault
**Description**: Safety-related fault detected in servo drive system
**Immediate Action**: **STOP OPERATION IMMEDIATELY**
**Required Response**:
1. Power down machine
2. Contact HGG technical support
3. Do not attempt restart until fault is resolved
4. Document exact circumstances when fault occurred

## ⚡ Electrical System Codes (E100 Series)

### E101 - Main Power Fault
**Description**: Issue with main electrical power supply
**Diagnostic Steps**:
1. Check main disconnect switch position
2. Verify incoming voltage levels (qualified electrician only)
3. Inspect main fuses and circuit breakers
4. Check for loose connections at main panel

**Typical Causes**:
- Power outage or voltage fluctuation
- Blown main fuses
- Tripped circuit breakers
- Loose electrical connections

### E102 - Control Power Loss
**Description**: Control system power supply fault
**Troubleshooting**:
1. Check control power transformer
2. Verify control fuses
3. Inspect control power connections
4. Test control power supply voltage

### E103 - Phase Loss Detected
**Description**: One or more phases of three-phase power are missing
**Critical Action**: **STOP MACHINE IMMEDIATELY**
**Resolution**:
1. Check all three phases at main disconnect
2. Inspect for blown fuses on any phase
3. Verify all three-phase connections secure
4. Contact electrician for power system diagnosis

### E110 - Servo Drive Fault
**Description**: Fault condition detected in axis servo drive
**Display Format**: E110-[Axis][Fault Code] (e.g., E110-X01 for X-axis fault 01)
**General Procedure**:
1. Note specific axis and fault code
2. Check servo drive LED indicators
3. Verify motor and feedback cable connections
4. Consult servo drive manual for specific fault code

**Common Servo Faults**:
- 01: Overcurrent fault
- 02: Overvoltage fault  
- 03: Motor overtemperature
- 04: Encoder feedback fault
- 05: Following error excessive

## 🔧 Mechanical System Codes (E200 Series)

### E201 - Axis Limit Switch Activated
**Description**: Machine axis has reached travel limit
**Display**: E201-[Axis] (e.g., E201-X for X-axis limit)
**Corrective Actions**:
1. Jog axis away from limit in opposite direction
2. Check for obstructions preventing normal travel
3. Verify limit switch operation and adjustment
4. Re-home axis if necessary

### E202 - Axis Following Error
**Description**: Actual axis position differs from commanded position by excessive amount
**Troubleshooting**:
1. Check for mechanical binding or obstruction
2. Verify proper lubrication of axis components
3. Inspect coupling connections
4. Check servo tuning parameters

### E203 - Spindle Fault
**Description**: Spindle drive system fault detected
**Immediate Actions**:
1. Stop spindle operation
2. Check spindle drive status indicators
3. Verify spindle motor connections
4. Inspect for mechanical damage or binding

**Spindle Fault Subcodes**:
- E203-01: Spindle overcurrent
- E203-02: Spindle overtemperature
- E203-03: Spindle speed error
- E203-04: Spindle orientation fault

### E210 - Tool Change Fault
**Description**: Automatic tool changer malfunction
**Diagnostic Steps**:
1. Check tool changer air pressure
2. Verify tool holder is properly seated
3. Inspect tool change mechanism for obstructions
4. Test tool clamp/unclamp operation manually

## 💨 Pneumatic System Codes (E300 Series)

### E301 - Air Pressure Low
**Description**: Compressed air pressure below minimum operating level
**Required Pressure**: Typically 6-8 bar (87-116 PSI)
**Troubleshooting**:
1. Check main air supply valve is open
2. Verify compressor operation
3. Inspect for air leaks in system
4. Check air filter condition and drain condensate

### E302 - Tool Clamp Pressure Fault
**Description**: Insufficient pressure for tool clamping operation
**Safety Concern**: **Do not operate with compromised tool clamping**
**Resolution Steps**:
1. Check tool clamp air pressure gauge
2. Test tool clamp/unclamp cycle manually
3. Inspect tool holder and spindle interface
4. Verify air pressure regulator settings

### E310 - Fixture Clamp Fault
**Description**: Workpiece clamping system pressure fault
**Immediate Action**: **Verify workpiece security before operation**
**Diagnostic Procedure**:
1. Check fixture air pressure
2. Test clamp/unclamp cycle
3. Inspect clamping mechanisms
4. Verify pressure switches operation

## 🖥️ Control System Codes (E400 Series)

### E401 - Communication Error
**Description**: Communication fault between control components
**Display**: E401-[Component] (e.g., E401-HMI for HMI communication fault)
**Troubleshooting**:
1. Check all communication cables secure
2. Verify network settings and addresses
3. Restart communication modules
4. Test cable continuity if necessary

### E402 - Memory Fault
**Description**: Control system memory error detected
**Critical Action**: **Contact HGG support immediately**
**Temporary Measures**:
1. Power cycle control system
2. Back up current programs if possible
3. Document when fault first occurred
4. Avoid loading new programs until resolved

### E403 - Program Error
**Description**: Error in loaded machining program
**Display**: E403-Line [Number] (e.g., E403-Line 245)
**Resolution**:
1. Note specific line number with error
2. Review program syntax at indicated line
3. Check for valid G-codes and parameters
4. Verify program compatibility with machine configuration

### E410 - Calibration Error
**Description**: Machine calibration parameters invalid or corrupted
**Required Action**: **Recalibration needed before operation**
**Procedure**:
1. Contact qualified technician
2. Perform complete machine calibration sequence
3. Verify all reference positions
4. Test with known good program

## 📏 Measurement System Codes (E500 Series)

### E501 - Probe Fault
**Description**: Touch probe system malfunction
**Diagnostic Steps**:
1. Check probe battery level
2. Verify probe stylus secure and undamaged
3. Test probe trigger function
4. Inspect probe mounting and connections

### E502 - Measurement Out of Range
**Description**: Measurement result exceeds expected range
**Possible Causes**:
- Incorrect measurement setup
- Part positioning error
- Probe calibration drift
- Program parameter error

### E510 - Laser Measurement Fault
**Description**: Laser measurement system error (if equipped)
**Troubleshooting**:
1. Check laser power and alignment
2. Verify measurement surface conditions
3. Inspect for obstructions in laser path
4. Calibrate laser measurement system

## 🌡️ Environmental System Codes (E600 Series)

### E601 - Temperature Fault
**Description**: System temperature outside operating range
**Operating Range**: Typically 15-35°C (59-95°F)
**Actions**:
1. Check workshop temperature
2. Verify machine ventilation
3. Inspect for heat sources near machine
4. Allow machine to reach stable temperature

### E602 - Humidity Fault
**Description**: Humidity level outside acceptable range
**Acceptable Range**: Typically 30-80% RH, non-condensing
**Resolution**:
1. Check for condensation on machine surfaces
2. Improve workshop climate control
3. Ensure adequate ventilation
4. Allow time for stabilization

## 🔧 Maintenance Reminder Codes (E700 Series)

### E701 - Scheduled Maintenance Due
**Description**: Preventive maintenance schedule has reached due date
**Information Display**: Shows specific maintenance task required
**Action Required**:
1. Review maintenance schedule
2. Perform indicated maintenance tasks
3. Reset maintenance timer after completion
4. Update maintenance records

### E702 - Lubrication System Warning
**Description**: Automatic lubrication system requires attention
**Possible Issues**:
- Low lubricant level
- Lubrication pump fault
- Distribution system blockage
- Lubrication cycle overdue

## 📞 Error Code Response Procedures

### Immediate Response Steps
1. **Record Error Code**: Note exact code and any additional information
2. **Assess Safety**: Determine if immediate safety action required
3. **Stop Operation**: Use appropriate stop method for situation
4. **Document Conditions**: Note what machine was doing when error occurred

### Information to Collect
- Complete error code and any subcodes
- Time and date of occurrence  
- Operating conditions when fault occurred
- Recent maintenance or changes
- Environmental conditions
- Any unusual sounds, vibrations, or observations

### When to Contact HGG Support
**Immediate Contact Required**:
- Any E000 series safety codes that cannot be easily resolved
- E402 Memory faults
- Repeated occurrence of same error code
- Multiple simultaneous error codes
- Any code not listed in this reference

**Information for HGG Support**:
- Machine serial number and model
- Complete error code
- Software version
- Detailed description of circumstances
- Steps already attempted
- Current machine status

## 🛠️ Error Code Reset Procedures

### Standard Reset Sequence
1. Address root cause of error condition
2. Clear error from HMI display (typically RESET button)
3. Verify system status indicators normal
4. Perform any required reinitialization
5. Test operation with caution

### System Restart After Major Faults
1. Power down main disconnect
2. Wait minimum 30 seconds
3. Restore power and allow system initialization
4. Home all axes
5. Verify calibration and reference positions
6. Test with simple program before production

---

**⚠️ IMPORTANT**: This reference covers common error codes. New codes may be added with software updates. Always consult latest documentation or contact HGG support for unknown codes.

**Emergency Contact**: HGG Technical Support +31 (0)73 599 6360
**Last Updated**: [Current Date]
**Document Version**: 1.0