import ApiError from './ApiError.js';

export function parsePagination(query, { defaultLimit = 25, maxLimit = 100 } = {}) {
  const rawPage = query.page === undefined ? 1 : Number(query.page);
  const rawLimit = query.limit === undefined ? defaultLimit : Number(query.limit);

  if (!Number.isInteger(rawPage) || rawPage < 1) {
    throw ApiError.badRequest('page must be a positive integer.');
  }
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > maxLimit) {
    throw ApiError.badRequest(`limit must be an integer between 1 and ${maxLimit}.`);
  }

  return {
    page: rawPage,
    limit: rawLimit,
    skip: (rawPage - 1) * rawLimit,
  };
}

export function paginationMeta({ total, page, limit }) {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}
