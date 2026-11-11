package com.curalithra.web.exception;

import org.springframework.http.HttpStatus;

public class ConflictException extends CuralithraException {
    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}
