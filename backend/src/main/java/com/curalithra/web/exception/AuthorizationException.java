package com.curalithra.web.exception;

import org.springframework.http.HttpStatus;

public class AuthorizationException extends CuralithraException {
    public AuthorizationException(String message) {
        super(HttpStatus.FORBIDDEN, message);
    }

    public AuthorizationException(HttpStatus status, String message) {
        super(status, message);
    }
}
