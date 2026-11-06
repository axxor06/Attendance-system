export async function loadAllSubjectPages(listSubjects, { pageSize = 100, maxPages = 100 } = {}) {
  const firstResponse = await listSubjects({ page: 1, limit: pageSize });
  const firstData = firstResponse?.data?.data || {};
  const firstSubjects = Array.isArray(firstData.subjects) ? firstData.subjects : [];
  const pages = Math.max(1, Number(firstData.pagination?.pages || 1));
  if (!Number.isInteger(pages) || pages > maxPages) {
    throw new Error('The subject directory is larger than the safe browser loading limit. Use a subject filter or contact an administrator.');
  }
  if (pages === 1) return firstSubjects;

  const remainingResponses = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) => listSubjects({ page: index + 2, limit: pageSize }))
  );
  return [
    ...firstSubjects,
    ...remainingResponses.flatMap((response) => response?.data?.data?.subjects || []),
  ];
}
