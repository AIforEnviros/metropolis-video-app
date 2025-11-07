# ipMIDI Troubleshooting Guide

**Date**: 2025-10-25 (Initial investigation) → 2025-11-07 (Updated)
**Status**: ✅ Root cause identified - Issue is in Ableton/macOS configuration, NOT app code
**Branch**: `master` (commits: c3716ce, dd8710c)

---

## 🎯 SUMMARY (Updated 2025-11-07)

### Root Cause Identified ✅
**The issue is NOT in our app code.** ipMIDI messages are not reaching ANY application on macOS, including external MIDI monitor apps.

### Key Finding
When testing with **MIDI Monitor** (third-party macOS app), it also shows **NO messages** from ipMIDI when triggering from Ableton Live. This proves the problem is in the **Ableton → ipMIDI → macOS routing configuration**, not in our application's MIDI handling.

### Code Fixes Applied (Working Correctly)
**Commit c3716ce:** Fixed event listener management
- Added `removeAllListeners('message')` to prevent stacking
- Added tiered logging with `--midi-debug` flag
- Enhanced error handling for network MIDI
- **Result:** App code is correct and working as expected

**Commit dd8710c:** Added comprehensive diagnostic logging
- Raw message logging: `🎹 RAW MIDI RECEIVED: [...]`
- Port details logging: `📋 MIDI Port Details: {...}`
- Listener confirmation: `👂 MIDI message listener attached and waiting...`
- **Result:** Confirms messages never reach app's message handler

### Testing Results
✅ Hardware MIDI keyboard → App: **Works perfectly**
❌ Ableton → ipMIDI → App: **No messages received**
❌ Ableton → ipMIDI → MIDI Monitor: **No messages received**
✅ macOS Network MIDI session: **Connected (no error badge)**
✅ Ableton MIDI preferences: **ipMIDI Track output enabled**

### Conclusion
The Ableton/macOS/ipMIDI routing chain is not functioning, despite appearing configured correctly. Issue is likely:
1. **Network MIDI session missing receiving endpoint** (Network MIDI requires both sender and receiver)
2. **ipMIDI loopback not supported** (if trying to route on same Mac, use IAC Driver instead)
3. **Ableton not actually sending to ipMIDI** (configuration appears correct but not functioning)

### Next Steps
1. **Clarify setup intent:** Is ipMIDI for loopback (same Mac) or network (Mac to Mac)?
2. **If loopback:** Switch to **IAC Driver** (built-in macOS MIDI routing for same-computer)
3. **If network:** Verify Network MIDI session has both sender AND receiver configured
4. **Test Ableton routing:** Verify MIDI actually leaves Ableton to ipMIDI output

---

## Original Problem Statement (2025-10-25)

The ipMIDI device (MIDI from Ableton Live via network MIDI) is detected and appears in the MIDI Device dropdown, but does not receive MIDI messages when selected. MIDI learn functionality also fails with ipMIDI.

### Symptoms
- ✅ ipMIDI device **IS** detected and listed in MIDI Device dropdown
- ❌ ipMIDI device **DOES NOT** receive MIDI messages when selected
- ❌ MIDI learn **DOES NOT** work with ipMIDI input
- ✅ Direct hardware MIDI keyboard works perfectly

---

## What We Know

1. **MIDI device detection works**: App successfully enumerates all MIDI devices including ipMIDI
2. **MIDI device switching exists**: Dropdown in Keyboard Shortcuts modal allows device selection
3. **Visual MIDI indicator exists**: App has built-in visual feedback for incoming MIDI messages
4. **Hardware MIDI works**: Direct MIDI keyboard connection functions correctly
5. **ipMIDI is selectable**: Device appears in list and can be selected

---

## User Workflow

User wants to switch between two MIDI input sources:
1. **Direct MIDI**: Hardware MIDI keyboard → App
2. **ipMIDI from Ableton**: Ableton Live → ipMIDI → App

**Important**: User does NOT want both sources active simultaneously - just toggle between them.

---

## Suspected Root Cause

### Location: `main.js:234-287` (`connectMIDIDevice()` function)

**Problem**: Event listener management issue

```javascript
// Line 248 in main.js
midiInput.on('message', (deltaTime, message) => {
    // ... message handling code
});
```

**Issue**: Each time `connectMIDIDevice()` is called:
- A new `'message'` event listener is added
- **BUT** old listeners are never removed
- This causes listener stacking/interference when switching devices

**Additional ipMIDI Consideration**: Network MIDI devices (ipMIDI) may have different connection requirements or timing than hardware MIDI devices.

---

## Diagnostic Test (DO THIS FIRST)

**Goal**: Determine if MIDI messages from Ableton are reaching the app at all

### Test Procedure

1. Launch the metropolis-video-app
2. Open **Keyboard Shortcuts** modal
3. Select **ipMIDI device** from MIDI Device dropdown
4. Open **Ableton Live**
5. Configure Ableton to send MIDI to ipMIDI output
6. Send MIDI notes/CC from Ableton
7. **Watch the visual MIDI activity indicator** in the app

### Interpret Results

**Scenario A: MIDI indicator shows activity (notes, channels, etc.)**
- ✅ MIDI messages ARE arriving at the app
- ❌ Issue is in message processing or MIDI learn system
- **Fix needed**: Check message routing from main process to renderer

**Scenario B: MIDI indicator shows NO activity**
- ❌ MIDI messages ARE NOT arriving at the app
- ❌ Issue is in device connection or port opening
- **Fix needed**: Fix event listener management and port connection

---

## Proposed Fix

### Fix A: Event Listener Management (Likely Fix)

**File**: `main.js`
**Function**: `connectMIDIDevice()` (line 234)

**Change**: Remove old listeners before adding new ones

```javascript
function connectMIDIDevice(portIndex) {
  try {
    // Close existing connection if any
    if (midiInput && currentMIDIPort !== null) {
      midiInput.closePort();
      // ADD THIS LINE:
      midiInput.removeAllListeners('message'); // Clear old event listeners
    }

    // Open the specified port
    midiInput.openPort(portIndex);
    currentMIDIPort = portIndex;

    console.log(`Connected to MIDI device: ${midiDevices[portIndex].name}`);

    // Set up message callback (now only ONE listener active)
    midiInput.on('message', (deltaTime, message) => {
      // ... existing message handling code
    });

    return { success: true, port: portIndex, name: midiDevices[portIndex].name };
  } catch (error) {
    console.error('MIDI connection error:', error);
    return { success: false, error: error.message };
  }
}
```

### Fix B: Enhanced Debugging

Add more detailed logging to track connection state:

```javascript
console.log(`Switching from device ${currentMIDIPort} to ${portIndex}`);
console.log(`Closing port for: ${currentMIDIPort !== null ? midiDevices[currentMIDIPort].name : 'none'}`);
console.log(`Opening port for: ${midiDevices[portIndex].name}`);
```

### Fix C: Port Opening Error Handling

Wrap `midiInput.openPort()` in try/catch to catch ipMIDI-specific errors:

```javascript
try {
  midiInput.openPort(portIndex);
  console.log(`✓ Successfully opened port ${portIndex}`);
} catch (error) {
  console.error(`✗ Failed to open port ${portIndex}:`, error);
  throw error;
}
```

---

## Implementation Steps (Tomorrow)

1. **Run diagnostic test** (see above) and note whether MIDI indicator shows activity
2. **Apply Fix A** (event listener management) - this is likely the main issue
3. **Apply Fix B** (enhanced logging) - helps debug if Fix A doesn't work
4. **Test with hardware MIDI keyboard** - ensure fix doesn't break existing functionality
5. **Test with ipMIDI from Ableton** - verify messages are received
6. **Test MIDI learn with ipMIDI** - verify mappings can be created
7. **Test switching between devices** - verify no stacking/interference

---

## Additional Investigation (If Fix A Doesn't Work)

### Check MIDI Message Format
- ipMIDI might send messages in different format than hardware MIDI
- Add logging in main.js to inspect raw MIDI bytes
- Compare hardware MIDI vs ipMIDI message structure

### Check Timing/Latency
- Network MIDI has higher latency than hardware MIDI
- May need debouncing or buffering for ipMIDI messages

### Check Port Naming
- ipMIDI device may have special characters in port name
- May need string sanitization when matching device names

---

## Testing Checklist

- [ ] Diagnostic test completed (MIDI indicator check)
- [ ] Fix A implemented (removeAllListeners)
- [ ] Hardware MIDI keyboard still works
- [ ] ipMIDI receives messages (indicator shows activity)
- [ ] MIDI learn works with ipMIDI
- [ ] Can switch between keyboard and ipMIDI without issues
- [ ] No console errors when switching devices
- [ ] Selected device persists across app restarts (if applicable)

---

## Related Files

- **main.js** (lines 203-323): MIDI initialization and device connection
- **script.js** (lines 3375-3390): `handleMIDIDeviceChange()` function
- **index.html** (lines 1392-1395): MIDI device dropdown UI

---

## Notes for Tomorrow

- User prefers to just fix the detection/connection - no need for fancy UI changes
- Visual MIDI indicator already exists - use it for diagnostics
- Event listener stacking is the most likely culprit
- Test both scenarios (keyboard and ipMIDI) thoroughly before committing

---

## Diagnostic Session Log (2025-11-07)

### Phase 1: Event Listener Fix
**Commit:** `c3716ce`
**Changes:**
- Added `midiInput.removeAllListeners('message')` before opening new device
- Implemented `MIDI_DEBUG` flag for verbose logging (`npm start -- --midi-debug`)
- Added enhanced error handling with network MIDI detection
- Device switching logs show port changes

**Testing:** Pushed to GitHub for collaborator testing on macOS with Ableton

### Phase 2: Diagnostic Logging
**Commit:** `dd8710c`
**Changes:**
- Added always-visible raw message logging (not behind debug flag)
- Added port details logging on connection
- Added listener confirmation message
- Console now clearly shows if messages arrive or not

**Testing Results:**
```
Console Output:
✓ Connected to MIDI device: ipMIDI Port 1
📋 MIDI Port Details: { ... }
👂 MIDI message listener attached and waiting for messages...

When triggering MIDI from Ableton:
❌ NO "🎹 RAW MIDI RECEIVED" logs appear
```

**Conclusion from console:** Messages never reach the app's MIDI handler

### Phase 3: External Verification
**Test:** Used macOS "MIDI Monitor" app to independently verify ipMIDI
**Result:** MIDI Monitor also sees **NO messages** from ipMIDI

**Critical Finding:** If external MIDI monitoring tools can't see messages either, the problem is definitively NOT in our app.

### Phase 4: Configuration Review
**Audio MIDI Setup:**
- Network MIDI session visible in MIDI Studio
- ipMIDI device shows NO red error badge (connected state)

**Ableton MIDI Preferences:**
- ipMIDI Port 1 appears in MIDI Ports list
- Track checkbox is enabled (yellow/lit)

**Despite correct-looking configuration:** No MIDI data flows from Ableton → ipMIDI

### Likely Issues (To Investigate Later)
1. **Network MIDI requires two endpoints:**
   - Sender (Ableton's Mac) ✓
   - Receiver (another device?) ❓
   - If no receiver configured, sender won't transmit

2. **ipMIDI may not support loopback on same Mac:**
   - Network MIDI designed for computer-to-computer
   - Same-Mac routing should use **IAC Driver** instead

3. **Ableton may not be routing internally:**
   - Even with Track enabled, MIDI may not leave Ableton
   - Need to verify with Ableton's internal MIDI monitor

### Recommended Solution: Use IAC Driver for Same-Mac Routing
If the goal is: **Ableton → MIDI → App (on same Mac)**

**Use IAC Driver instead of ipMIDI:**
1. Audio MIDI Setup → MIDI Studio
2. Double-click "IAC Driver"
3. Enable "Device is online"
4. Use "IAC Bus 1" in both Ableton and app
5. Test: Should work for same-computer MIDI routing

---

**Last Updated**: 2025-11-07
**Status**: App code working correctly. Issue is Ableton/macOS/ipMIDI configuration.
**Next Session**: Clarify ipMIDI use case (loopback vs network), test IAC Driver alternative
