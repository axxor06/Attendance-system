function cleanMongoId(value) {
  const candidate = typeof value === 'object' ? value?._id ?? value?.id : value;
  const normalized = candidate == null ? '' : String(candidate);
  return /^[0-9a-f]{24}$/i.test(normalized) ? normalized : '';
}

export function filterFacultyPeriods(periods, { source, subjectId, facultyId }) {
  const subject = cleanMongoId(subjectId);
  const faculty = cleanMongoId(facultyId);
  return (periods || []).filter((period) => (
    period.kind === 'class'
    && (source !== 'class-timetable' || (
      cleanMongoId(period.subject) === subject
      && cleanMongoId(period.faculty) === faculty
    ))
  ));
}
