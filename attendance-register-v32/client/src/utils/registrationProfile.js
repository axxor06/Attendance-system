// Client-side mirror of server/src/utils/registrationProfile.js. The server is
// the authority; this only gives applicants immediate, per-field feedback.

export const EDUCATION_LEVELS = [
  { value: 'class_10', label: 'Class 10' },
  { value: 'class_12', label: 'Class 12' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'degree', label: 'Degree' },
  { value: 'other', label: 'Other' },
];

export const MIN_YEAR = 1950;

export function currentYear(now = new Date()) {
  return now.getFullYear();
}

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function checkText(errors, key, value, label, { min = 2, max = 150 } = {}) {
  const text = clean(value);
  if (!text) errors[key] = `${label} is required.`;
  else if (text.length < min) errors[key] = `${label} must be at least ${min} characters.`;
  else if (text.length > max) errors[key] = `${label} may not exceed ${max} characters.`;
}

function checkYear(errors, key, value, label, now) {
  const text = String(value ?? '').trim();
  const year = Number(text);
  if (!text) errors[key] = `${label} is required.`;
  else if (!/^\d{4}$/.test(text) || year < MIN_YEAR || year > currentYear(now)) {
    errors[key] = `Enter a four-digit year between ${MIN_YEAR} and ${currentYear(now)}.`;
  }
}

export function validatePercentage(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text) || Number(text) > 100) return 'Enter a number from 0 to 100 with at most two decimals.';
  return null;
}

export function validateExperienceYears(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'Enter your total experience in years. Use 0 if you have none.';
  if (!/^\d{1,2}(\.\d)?$/.test(text) || Number(text) > 60) return 'Enter a number of years between 0 and 60, for example 0, 2.5 or 12.';
  return null;
}

export const emptyStudentEducation = () => ({ level: '', levelOther: '', institution: '', boardOrUniversity: '', yearOfCompletion: '', percentage: '', alternativeResult: '' });
export const emptyFacultyProfile = () => ({ qualification: '', specialization: '', institution: '', yearOfCompletion: '', totalYears: '', previousInstitution: '', previousRole: '' });

export function validateStudentEducation(values, now = new Date()) {
  const errors = {};
  if (!values.level) errors.level = 'Choose your last completed education.';
  if (values.level === 'other') checkText(errors, 'levelOther', values.levelOther, 'Education level', { max: 60 });
  checkText(errors, 'institution', values.institution, 'School or college');
  checkText(errors, 'boardOrUniversity', values.boardOrUniversity, 'Board or university');
  checkYear(errors, 'yearOfCompletion', values.yearOfCompletion, 'Year of completion', now);
  const percentageError = validatePercentage(values.percentage);
  if (percentageError) errors.percentage = percentageError;
  else if (!String(values.percentage ?? '').trim() && !clean(values.alternativeResult)) {
    errors.percentage = 'Enter your percentage, or an alternative result such as a CGPA or grade.';
  }
  if (clean(values.alternativeResult).length > 60) errors.alternativeResult = 'Keep this under 60 characters.';
  return errors;
}

export function validateFacultyProfile(values, now = new Date()) {
  const errors = {};
  checkText(errors, 'qualification', values.qualification, 'Highest qualification', { max: 120 });
  checkText(errors, 'specialization', values.specialization, 'Specialization or subject', { max: 120 });
  checkText(errors, 'institution', values.institution, 'Institution');
  checkYear(errors, 'yearOfCompletion', values.yearOfCompletion, 'Year of completion', now);
  const yearsError = validateExperienceYears(values.totalYears);
  if (yearsError) errors.totalYears = yearsError;
  else if (Number(values.totalYears) > 0) {
    checkText(errors, 'previousInstitution', values.previousInstitution, 'Previous workplace');
    checkText(errors, 'previousRole', values.previousRole, 'Previous role', { max: 100 });
  }
  return errors;
}

export function hasExperience(values) {
  return validateExperienceYears(values.totalYears) === null && Number(values.totalYears) > 0;
}

export function buildStudentEducationPayload(values) {
  const percentage = String(values.percentage ?? '').trim();
  return {
    level: values.level,
    ...(values.level === 'other' ? { levelOther: clean(values.levelOther) } : {}),
    institution: clean(values.institution),
    boardOrUniversity: clean(values.boardOrUniversity),
    yearOfCompletion: Number(values.yearOfCompletion),
    ...(percentage ? { percentage } : {}),
    ...(clean(values.alternativeResult) ? { alternativeResult: clean(values.alternativeResult) } : {}),
  };
}

export function buildFacultyPayload(values) {
  const worked = hasExperience(values);
  return {
    facultyEducation: {
      qualification: clean(values.qualification),
      specialization: clean(values.specialization),
      institution: clean(values.institution),
      yearOfCompletion: Number(values.yearOfCompletion),
    },
    experience: {
      totalYears: String(values.totalYears).trim(),
      ...(worked ? { previousInstitution: clean(values.previousInstitution), previousRole: clean(values.previousRole) } : {}),
    },
  };
}
