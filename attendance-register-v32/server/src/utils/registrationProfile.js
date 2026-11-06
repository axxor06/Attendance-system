import { EDUCATION_LEVELS } from '../config/constants.js';
import ApiError from './ApiError.js';

/**
 * Validation + normalisation for the education/experience data collected at
 * registration. All rules live here (not scattered through route validators)
 * so the controller, the tests and any future import path share one source of
 * truth. Functions return a *new* plain object containing only known fields;
 * callers never persist raw request bodies.
 */

const MIN_YEAR = 1950;

function currentYear(now = new Date()) {
  return now.getUTCFullYear();
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function fail(errors) {
  throw ApiError.badRequest('Please correct the highlighted registration details.', errors);
}

function requireText(source, key, label, errors, { min = 2, max = 150 } = {}) {
  const value = cleanText(source?.[key]);
  if (!value) errors.push(`${label} is required.`);
  else if (value.length < min) errors.push(`${label} must be at least ${min} characters.`);
  else if (value.length > max) errors.push(`${label} may not exceed ${max} characters.`);
  return value;
}

function optionalText(source, key, label, errors, { max = 150 } = {}) {
  const value = cleanText(source?.[key]);
  if (value.length > max) errors.push(`${label} may not exceed ${max} characters.`);
  return value;
}

function parseYear(value, label, errors, now) {
  if (value === undefined || value === null || value === '') {
    errors.push(`${label} is required.`);
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < MIN_YEAR || number > currentYear(now)) {
    errors.push(`${label} must be a four-digit year between ${MIN_YEAR} and ${currentYear(now)}.`);
    return null;
  }
  return number;
}

/** Accepts 0-100 with at most two decimals. Returns null for blank input. */
export function parsePercentage(value, errors) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) {
    errors.push('Percentage must be a number between 0 and 100 with at most two decimals.');
    return null;
  }
  const number = Number(text);
  if (number < 0 || number > 100) {
    errors.push('Percentage must be between 0 and 100.');
    return null;
  }
  return number;
}

/** Accepts 0-60 years with at most one decimal (0, 1, 2.5, 12 ...). */
export function parseExperienceYears(value, errors) {
  if (value === undefined || value === null || String(value).trim() === '') {
    errors.push('Total experience in years is required. Enter 0 if you have none.');
    return null;
  }
  const text = String(value).trim();
  if (!/^\d{1,2}(\.\d)?$/.test(text)) {
    errors.push('Total experience must be a number of years between 0 and 60, for example 0, 1, 2.5 or 12.');
    return null;
  }
  const number = Number(text);
  if (number < 0 || number > 60) {
    errors.push('Total experience must be between 0 and 60 years.');
    return null;
  }
  return number;
}

export function normalizeStudentEducation(input, { now = new Date() } = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(['Previous education details are required.']);

  const level = cleanText(input.level).toLowerCase();
  if (!EDUCATION_LEVELS.includes(level)) errors.push('Choose the last completed education level.');
  const levelOther = level === 'other'
    ? requireText(input, 'levelOther', 'Education level description', errors, { min: 2, max: 60 })
    : '';
  const institution = requireText(input, 'institution', 'Previous school or college', errors);
  const boardOrUniversity = requireText(input, 'boardOrUniversity', 'Board or university', errors);
  const yearOfCompletion = parseYear(input.yearOfCompletion, 'Year of completion', errors, now);
  const percentage = parsePercentage(input.percentage, errors);
  const alternativeResult = optionalText(input, 'alternativeResult', 'Alternative result', errors, { max: 60 });
  if (percentage === null && !alternativeResult && !errors.some((message) => message.startsWith('Percentage'))) {
    errors.push('Enter your percentage, or an alternative result such as a CGPA or grade.');
  }
  if (errors.length) fail(errors);
  return { level, levelOther, institution, boardOrUniversity, yearOfCompletion, percentage, alternativeResult };
}

export function normalizeFacultyEducation(input, { now = new Date() } = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(['Educational background is required.']);
  const qualification = requireText(input, 'qualification', 'Highest qualification', errors, { min: 2, max: 120 });
  const specialization = requireText(input, 'specialization', 'Specialization or subject', errors, { min: 2, max: 120 });
  const institution = requireText(input, 'institution', 'Institution', errors);
  const yearOfCompletion = parseYear(input.yearOfCompletion, 'Year of completion', errors, now);
  if (errors.length) fail(errors);
  return { qualification, specialization, institution, yearOfCompletion };
}

export function normalizeExperience(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(['Experience details are required.']);
  const totalYears = parseExperienceYears(input.totalYears, errors);
  let previousInstitution = '';
  let previousRole = '';
  if (totalYears !== null && totalYears > 0) {
    previousInstitution = requireText(input, 'previousInstitution', 'Previous workplace', errors);
    previousRole = requireText(input, 'previousRole', 'Previous role or designation', errors, { min: 2, max: 100 });
  }
  // With zero years of experience any previous-employment text is discarded:
  // fresh graduates must never be forced (or tempted) to record fake history.
  if (errors.length) fail(errors);
  return { totalYears, previousInstitution, previousRole };
}
