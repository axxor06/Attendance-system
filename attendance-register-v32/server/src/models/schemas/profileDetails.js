import mongoose from 'mongoose';
import { EDUCATION_LEVELS } from '../../config/constants.js';

const { Schema } = mongoose;

/** Previous education supplied by a student applicant. */
export const previousEducationSchema = new Schema(
  {
    level: { type: String, enum: EDUCATION_LEVELS, required: true },
    levelOther: { type: String, trim: true, maxlength: 60, default: '' },
    institution: { type: String, trim: true, maxlength: 150, required: true },
    boardOrUniversity: { type: String, trim: true, maxlength: 150, required: true },
    yearOfCompletion: { type: Number, min: 1950, max: 2200, required: true },
    // Percentage is optional only when an alternative result (CGPA/grade) is supplied.
    percentage: { type: Number, min: 0, max: 100, default: null },
    alternativeResult: { type: String, trim: true, maxlength: 60, default: '' },
  },
  { _id: false },
);

/** Highest qualification supplied by a faculty applicant. */
export const facultyEducationSchema = new Schema(
  {
    qualification: { type: String, trim: true, maxlength: 120, required: true },
    specialization: { type: String, trim: true, maxlength: 120, required: true },
    institution: { type: String, trim: true, maxlength: 150, required: true },
    yearOfCompletion: { type: Number, min: 1950, max: 2200, required: true },
  },
  { _id: false },
);

/** Professional experience supplied by a faculty applicant. Zero years is valid. */
export const experienceSchema = new Schema(
  {
    totalYears: { type: Number, min: 0, max: 60, required: true },
    previousInstitution: { type: String, trim: true, maxlength: 150, default: '' },
    previousRole: { type: String, trim: true, maxlength: 100, default: '' },
  },
  { _id: false },
);
