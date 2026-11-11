package com.curalithra.web.exception;

import org.springframework.http.HttpStatus;

public class ValidationException extends CuralithraException {
    public ValidationException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}
