package com.curalithra.web.exception;

import org.springframework.http.HttpStatus;

public class NotFoundException extends CuralithraException {
    public NotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }
}
