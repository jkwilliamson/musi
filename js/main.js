"use strict";

document.getElementById("identify-button").addEventListener("click", interval);
document.getElementById("clear-button").addEventListener("click", function (e) {
  for (const element of document.getElementsByClassName("note-input")) {
    element.value = "";
  }
  clearIntervalOutput();
});

/**
 * Removes all elements inside interval output divs and sets their displays to "none".
 */
function clearIntervalOutput() {
  document.getElementById("interval-text-output").replaceChildren();
  document.getElementById("interval-text-output").style.display = "none";

  document.getElementById("interval-vex-output").replaceChildren();
  document.getElementById("interval-vex-output").style.display = "none";
}

/**
 * Writes message to new p element in interval output text div and sets div display to "block".
 * @param {String} output
 */
function writeIntervalOutputText(output) {
  const p = document.createElement("p");
  p.textContent = output;
  const textOutputDiv = document.getElementById("interval-text-output");
  textOutputDiv.appendChild(p);
  textOutputDiv.style.display = "block";
}

/**
 * Uses VexFlow module to create a staff image representation of the notes in the interval output
 * Vex div; sets div display to "block"
 * @param {String[]} spnArray 
 * @returns 
 */
function writeIntervalOutputVex(spnArray) {
  const spnChord = `${spnArray[0]} ${spnArray[1]}`;
  const vexOutputDiv = document.getElementById("interval-vex-output");

  import("https://cdn.jsdelivr.net/npm/vexflow/build/cjs/vexflow.js").then(module => {
    const { Factory } = VexFlow;
    const factory = new Factory({
      renderer: { elementId: vexOutputDiv, width: 100, height: 150 },
    });
    const score = factory.EasyScore();
    factory.System().addStave({
      voices: [score.voice(score.notes(`(${spnChord})/1`, { stem: "up" }))],
    }).addClef("treble");
    factory.draw();
  }).catch(error => {
    console.log(error);
    return false;
  });

  vexOutputDiv.style.display = "block";
  return true;
}

/**
 * Calculates interval between two user input notes, displays notes in staff, and plays the interval
 * with a piano sound.
 */
function interval() {
  clearIntervalOutput();

  const bottomNote = document.getElementById("bottom-note-input").value.trim();
  const topNote = document.getElementById("top-note-input").value.trim();

  // Validate note inputs
  const noteValidation = validateNotes([bottomNote, topNote]);
  switch (typeof(noteValidation)) {
    case 'boolean':
      if (noteValidation === true) { // TRUE when all non-empty input notes are valid
        // EMPTY INPUT CHECK
        // invalid notes take priority, even when the other input is empty
        if (bottomNote.length == 0 || topNote.length == 0) {
          writeIntervalOutputText("You must input two notes!");
          return;
        } // ELSE all input notes are valid and non-empty
        break; // this is the only switch break
      }

      writeIntervalOutputText("[DEBUG] A type error has occurred.");
      console.log(`noteValidation() returned something other than a boolean or an object, which it shouldn't be able to do.`)
      return;

    case 'object': // ARRAY: inform user that one or both of their notes were invalid
      writeIntervalOutputText(invalidNotesToString(noteValidation));
      return;
  }

  // Calculate and output formatted interval name
  const intervalName = calculateIntervalName(bottomNote, topNote);
  let intervalOutputText = `${bottomNote} → ${topNote} is`;
  if (intervalName.charAt(0) == 'A') { // "an" augmented
    intervalOutputText += " an";
  } else {
    intervalOutputText += " a";
  }
  intervalOutputText += ` ${intervalName}`;
  writeIntervalOutputText(intervalOutputText);

  // Calculate scientific pitch notation (SPN) and use VexFlow module to draw notes
  const spnArray = intervalToSPNs(bottomNote, topNote);
  writeIntervalOutputVex(spnArray);

  // Wait for VexFlow svg to be generated, then increase width.
  waitForElement("svg", (element) => { 
    element.style.width = "250px";
  });

  // Create audios and utilize SPNs to determine which audio file to use for each note.
  const bottomNoteAudio = new Audio();
  const bottomAudioSource = document.createElement("source");
  bottomAudioSource.type = "audio/mpeg";
  bottomAudioSource.src = `sounds/${spnAudioNumber(spnArray[0])}.mp3`;
  bottomNoteAudio.appendChild(bottomAudioSource);
  bottomNoteAudio.volume = 0.4;

  const topNoteAudio = new Audio();
  const topAudioSource = document.createElement("source");
  topAudioSource.type = "audio/mpeg";
  topAudioSource.src = `sounds/${spnAudioNumber(spnArray[1])}.mp3`;
  topNoteAudio.appendChild(topAudioSource);
  topNoteAudio.volume = 0.4;

  // Play both audios at the same time
  bottomNoteAudio.play();
  topNoteAudio.play();
}

function calculateIntervalName(bottomNote, topNote) {
  const bottomHalfSteps = noteToHalfSteps(bottomNote);
  const topHalfSteps = noteToHalfSteps(topNote);

  let halfStepDifference;
  if (bottomHalfSteps < topHalfSteps) {
    halfStepDifference = topHalfSteps - bottomHalfSteps;
  } else {
    halfStepDifference = (topHalfSteps + 12) - bottomHalfSteps;
  }
  
  // Normalize half step difference such that for all intervals, difference = 0 if perfect or major
  let normalizedDifference = halfStepDifference;
  let flexible = true; // "flexible" means it can be major/minor, as opposed to perfect
  let intervalName; // this is our return value

  /********** musicTheory **********
   * Inflexible Interval Qualities *
   *********************************
   *   Quintuple-Diminished = -5   *
   *   Quadruple-Diminished = -4   *
   *      Triple-Diminished = -3   *
   *      Double-Diminished = -2   *
   *             Diminished = -1   *
   *                Perfect =  0   *
   *              Augmented =  1   *
   *       Double-Augmented =  2   *
   *       Triple-Augmented =  3   *
   *    Quadruple-Augmented =  4   *
   *    Quintuple-Augmented =  5   *
   *********************************
   *  Flexible Interval Qualities  *
   *********************************
   *   Quintuple-Diminished = -6   *
   *   Quadruple-Diminished = -5   *
   *      Triple-Diminished = -4   *
   *      Double-Diminished = -3   *
   *             Diminished = -2   *
   *                  Minor = -1   *
   *                  Major =  0   *
   *              Augmented =  1   *
   *       Double-Augmented =  2   *
   *       Triple-Augmented =  3   *
   *    Quadruple-Augmented =  4   *
   *    Quintuple-Augmented =  5   *
   *********************************/

  switch(wholeStepDifference(bottomNote.charAt(0), topNote.charAt(0))) {
    case 1:
      normalizedDifference -= 2; // Major Second = 2 half steps
      if (normalizedDifference > 4) normalizedDifference -= 12;
      intervalName = "Second";
      break;
    case 2:
  		normalizedDifference -= 4; // Major Third = 4 half steps
  		if (normalizedDifference > 4) normalizedDifference -= 12;
  		intervalName = "Third";
  		break;
  	case 3:
  		normalizedDifference -= 5; // Perfect Fourth = 5 half steps
  		flexible = false;
  		intervalName = "Fourth";
  		break;
  	case 4:
  		normalizedDifference -= 7; // Perfect Fifth = 7 half steps
  		flexible = false;
  		intervalName = "Fifth";
  		break;
  	case 5:
  		if (normalizedDifference > 1) normalizedDifference -= 12;
  		normalizedDifference += 3; // Major Sixth = 9/-3 half steps
  		intervalName = "Sixth";
  		break;
  	case 6:
  		if (normalizedDifference > 3) normalizedDifference -= 12;
  		normalizedDifference += 1; // Major Seventh = 11/-1 half steps
  		intervalName = "Seventh";
  		break;
  	case 7:
  		if (normalizedDifference > 4) normalizedDifference -= 12; // Perfect Octave = 0 half steps
  		flexible = false;
  		intervalName = "Octave";
  		break;
    default:
      writeIntervalOutputText("[DEBUG] An error occurred while calculating interval.");
      throw "An error occurred while calculating interval.";
  }

  if (!flexible) {
    if (normalizedDifference < 0) {
      normalizedDifference--;
    } else if (normalizedDifference == 0) {
      intervalName = "Perfect " + intervalName;
    }
  } else if (normalizedDifference == 0) {
    intervalName = "Major " + intervalName;
  } else if (normalizedDifference == -1) {
    intervalName = "Minor " + intervalName;
  }

  if (normalizedDifference < -1) {
    intervalName = "Diminished " + intervalName;
  } else if (normalizedDifference > 0) {
    intervalName = "Augmented " + intervalName;
  }

  // Normalized interval names for augmented inflexible vs. flexible are the same,
  // but for diminished, they are identical if we shift the difference by 1 for flexible intervals.
  // Additionally, this is now possible:
  // abs(normalized) for diminished name = that of the augmented name
  if (normalizedDifference < 0) { 
    normalizedDifference++; 
  }

  switch(Math.abs(normalizedDifference)) {
    case 5:
      intervalName = "Quintuple-" + intervalName;
      break;
    case 4:
      intervalName = "Quadruple-" + intervalName;
      break;
    case 3:
      intervalName = "Triple-" + intervalName;
      break;
    case 2:
      intervalName = "Double-" + intervalName;
  }

  return intervalName;
}

/**
 * Calculates the number of whole steps between two notes, disregarding accidentals. 
 * Order of the arguments matters.
 *
 * @param {String} bottomNote
 * @param {String} topNote
 * @returns non-negative difference between two notes
 */
function wholeStepDifference(bottomNote, topNote) {
  const bottomSteps = noteToWholeSteps(bottomNote);
  const topSteps = noteToWholeSteps(topNote);

  if (bottomSteps < topSteps) {
    return topSteps - bottomSteps;
  }

  return (topSteps + 7) - bottomSteps;
}

/**
 * C = 0 and B = 6 as per scientific pitch notation octaves start at C.
 *
 * @param {String} note
 * @returns [0, 6] corresponding whole step value relative to C = 0
 */
function noteToWholeSteps(note) {
  // Utilizes char codes
  // C = 67: subtract by 67, and add 7 if result is negative
  let wholeSteps = note.charCodeAt(0) - 67;
  if (wholeSteps > 4 || wholeSteps < -2) {
    // should not be possible since note is pre-validated, throw exception
    throw new "Note could not be converted into integer: invalid note";
  }
  if (wholeSteps < 0) {
    wholeSteps += 7;
  }
  return wholeSteps;
}

/**
 * C = 0, D = 2, ..., B = 11 as per scientific pitch notation octaves starting at C.
 * Also modifies return value by accidentals:
 * '#' = +1, 'b' = -1, '*' and '##' = +2, 'bb' = -2,
 * thus has potential to return a negative value (Cb and Cbb).
 *
 * @param {String} note 
 * @returns [-2, 13] corresponding half step value relative to C = 0
 */
function noteToHalfSteps(note) {
  let halfSteps;
  switch (note.charAt(0)) {
    case 'C':
      halfSteps = 0;
      break;
    case 'D':
      halfSteps = 2;
      break;
    case 'E':
      halfSteps = 4;
      break;
    case 'F':
      halfSteps = 5;
      break;
    case 'G':
      halfSteps = 7;
      break;
    case 'A':
      halfSteps = 9;
      break;
    case 'B':
      halfSteps = 11;
      break;
    default:
      throw new "Note could not be converted into integer: invalid note";
  }

  halfSteps += accidentalToHalfSteps(note.slice(1));
  return halfSteps;
}

/**
 * Calculates how much an accidental will change half steps by:
 * '#' = +1, 'b' = -1, '*' and '##' = +2, 'bb' = -2.
 * Note must be sliced BEFORE being passed to this function.
 * 
 * @param {String} accidental 
 * @returns 
 */
function accidentalToHalfSteps(accidental) {
  switch (accidental) {
    case "":
      return 0;
      break;
    case "b":
      return -1;
      break;
    case "bb":
      return -2;
      break;
    case "#":
      return 1;
      break;
    case "*":
    case "##":
      return 2;
      break;
    default:
      throw "Invalid accidental";
  }
}

/**
 * Converts scientific pitch notation to a number, where C4 = 0 and half step deviations from 0 are
 * of size 1. Used for accessing associated mp3 file.
 * Anchored at "middle C" (SPN = C4), any octave numbers will modify number by 12.
 *
 * @param {String} spn
 * @returns number in range [-2, 25]
 */
function spnAudioNumber(spn) {
  let audioNumber = noteToHalfSteps(spn.slice(0, spn.length - 1));

  if (spn.charAt(spn.length - 1) > 4) {
    audioNumber += 12 * (spn.charAt(spn.length - 1) - 4);
  } else if (spn.charAt(spn.length - 1) < 4) {
    audioNumber -= 12 * (spn.charAt(spn.length - 1) - 4);
  }

  return audioNumber;
}

/**
 * Calculates SPN octave numbers. The bottom note will always be in octave 4, and the top note
 * is calculated based on this to find the most closed interval possible.
 * Thus range is hardcoded to only output Cbb4-B*5.
 *
 * @param {String} bottomNote 
 * @param {String} topNote 
 * @returns array of SPN Strings
 */
function intervalToSPNs(bottomNote, topNote) {
  let spnArray = [];

  let bottomSPN = bottomNote.charAt(0);
  if (bottomNote.charAt(1) == '*') {
    bottomSPN += "##";
  } else {
    bottomSPN += bottomNote.slice(1);
  }
  bottomSPN += "4";

  spnArray.push(bottomSPN);

  let topSPN = topNote.charAt(0);
  if (topNote.charAt(1) == '*') {
    topSPN += "##";
  } else {
    topSPN += topNote.slice(1);
  }
  
  const bottomWholeSteps = noteToWholeSteps(bottomNote);
  const topWholeSteps = wholeStepDifference(bottomNote, topNote);

  if (topWholeSteps >= 1 && topWholeSteps <= 6 - bottomWholeSteps) {
    topSPN += "4";
  } else {
    topSPN += "5";
  }

  spnArray.push(topSPN);
  return spnArray;
}

/**
 * Validates notes, does not handle error output.
 *
 * @param {stringArray} notes
 * @returns TRUE if all notes are valid, 
 *          SET of invalid notes, or
 *          FALSE if argument is not a String Array
 */
function validateNotes(notes) {
  if (!validateArrayType(notes)) {
    return false; // return false if not an Array
  }

  const invalidNotes = new Set();
  for (const note of notes) {
    if (!validateStringType(note)) { 
      return false; // return false if Array element is not a String
    }

    // do not consider empty Strings
    if (note.length == 0) {
      continue;
    }
    
    if (!validateNote(note)) { 
      invalidNotes.add(note); // add note to return Array if invalid
    }
  }

  // return true if notes are all valid
  if (invalidNotes.size == 0) {
    return true;
  }
  // return Array of invalid notes
  return Array.from(invalidNotes);
}

/**
 * Validates note formatting:
 * Allowed notes are A-G,
 * accidentals are b, bb, #, ##, and *.
 *
 * @param {*} note 
 * @returns 
 */
function validateNote(note) {
  if (!validateStringType) {
    return false;
  }
  if (note.length == 0) {
    return true; // do not consider empty strings
  }

  // charAt(0) must be in letter range 'A-G'
  if (note.charAt(0) < 'A' || note.charAt(0) > 'G') {
    return false;
  }
  if (note.length == 1) {
    return true;
  }

  // charAt(1) must be 'b', '#', or '*'
  if (note.charAt(1) !== 'b' && note.charAt(1) !== '#' && note.charAt(1) !== '*') {
    return false;
  }
  if (note.length == 2) {
    return true;
  }

  // charAt(2) must be 'b' or '#', only if they follow correspondingly 'b' or '#'
  if (note.charAt(2) === 'b') {
    return note.charAt(1) === 'b';
  } else if (note.charAt(2) === '#') {
    return note.charAt(1) === '#';
  }
  return false;
}

/**
 * Formats invalid notes into a user-friendly message.
 *
 * @param {String[]} invalidNotes 
 * @returns 
 */
function invalidNotesToString(invalidNotes) {
  if (invalidNotes.length == 0) {
    return false;
  }
  invalidNotes = Array.from(invalidNotes);

  let text = `"${invalidNotes[0]}"`;
  if (invalidNotes.length > 2) {
    text += ",";
  }

  for (let i = 1; i < invalidNotes.length; i++) {
    if (i == invalidNotes.length - 1) {
      text += ` and "${invalidNotes[i]}"`;
    } else {
      text += ` "${invalidNotes[i]}",`;
    }
  }

  text += invalidNotes.length == 1 ? ` is not a valid note!` : ` are not valid notes!`;
  return text;
}

/**
 * Validates argument is of type String
 *
 * @param {String} str 
 * @returns true if argument is a String
 */
function validateStringType(str) {
  return (typeof str === 'string' || str instanceof String);
}

/**
 * Validates argument is of type Array
 *
 * @param {Array} arr 
 * @returns true if argument is an Array
 */
function validateArrayType(arr) {
  return arr.constructor === Array;
}

/**
 * Created by https://medium.com/@ryan_forrester_
 * Article:
 * https://medium.com/@ryan_forrester_/javascript-wait-for-element-to-exist-simple-explanation-1cd8c569e354
 */
function waitForElement(selector, callback) {
  const observer = new MutationObserver((mutations, observer) => {
    const element = document.querySelector(selector);
    if (element) {
      observer.disconnect();
      callback(element);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
