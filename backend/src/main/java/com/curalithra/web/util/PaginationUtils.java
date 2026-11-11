package com.curalithra.web.util;

import com.curalithra.web.dto.CommonDtos;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Map;
import java.util.function.Function;

public final class PaginationUtils {
    private PaginationUtils() {}

    public static Pageable createPageable(int page, int size, String sortBy, String sortDir,
                                          Map<String, String> allowedSortColumns, String defaultSortColumn) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);
        String resolvedColumn = allowedSortColumns.getOrDefault(sortBy == null ? "" : sortBy.trim(), defaultSortColumn);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return PageRequest.of(safePage, safeSize, Sort.by(direction, resolvedColumn));
    }

    public static <E, D> CommonDtos.PagedResponse<D> toPagedResponse(Page<E> page, Function<E, D> mapper) {
        return new CommonDtos.PagedResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast()
        );
    }
}
