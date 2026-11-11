package com.curalithra.web.exception;

import org.springframework.http.HttpStatus;

public class CuralithraException extends RuntimeException {
    private final HttpStatus status;

    public CuralithraException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
