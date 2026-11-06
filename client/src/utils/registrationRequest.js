export const isFacultyRequest = (request) => ['faculty', 'admin'].includes(String(request?.requestedRole || '').toLowerCase());
