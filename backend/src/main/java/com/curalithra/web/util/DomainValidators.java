package com.curalithra.web.util;

import com.curalithra.web.exception.ValidationException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class DomainValidators {

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern PHONE_ALLOWED =
            Pattern.compile("^[+]?[0-9\\s()-]{7,20}$");
    private static final Pattern USERNAME_PATTERN =
            Pattern.compile("^[A-Za-z0-9._-]{3,32}$");
    private static final DateTimeFormatter TIME_24H =
            DateTimeFormatter.ofPattern("HH:mm").withResolverStyle(ResolverStyle.STRICT);
    private static final Set<String> VALID_BLOOD_GROUPS =
            Set.of("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown");

    private DomainValidators() {}

    public static String requireNonBlank(String value, String fieldName) {
        if (value == null || value.trim().isEmpty()) {
            throw new ValidationException(fieldName + " is required.");
        }
        return value.trim();
    }

    public static String optionalTrimmed(String value) {
        return value == null ? "" : value.trim();
    }

    public static String validateUsername(String username) {
        String clean = requireNonBlank(username, "Username");
        if (!USERNAME_PATTERN.matcher(clean).matches()) {
            throw new ValidationException(
                    "Username must be 3-32 characters and contain only letters, numbers, '.', '_', or '-'.");
        }
        return clean.toLowerCase(Locale.ROOT);
    }

    public static String validateEmail(String email, boolean required) {
        String clean = optionalTrimmed(email);
        if (clean.isEmpty()) {
            if (required) {
                throw new ValidationException("Email address is required.");
            }
            return "";
        }
        if (!EMAIL_PATTERN.matcher(clean).matches()) {
            throw new ValidationException("Please enter a valid email address (e.g., name@hospital.org).");
        }
        return clean.toLowerCase(Locale.ROOT);
    }

    public static String validatePhone(String phone, boolean required) {
        String clean = optionalTrimmed(phone);
        if (clean.isEmpty()) {
            if (required) {
                throw new ValidationException("Phone number is required.");
            }
            return "";
        }
        if (!PHONE_ALLOWED.matcher(clean).matches()) {
            throw new ValidationException("Phone number may contain digits, +, spaces, hyphens, or parentheses.");
        }
        String digitsOnly = clean.replaceAll("[^0-9]", "");
        if (digitsOnly.length() < 7 || digitsOnly.length() > 15) {
            throw new ValidationException("Phone number must contain between 7 and 15 digits.");
        }
        return clean;
    }

    public static LocalDate validateDateOfBirth(LocalDate dob) {
        return validateDateOfBirth(dob, ZoneOffset.UTC);
    }

    public static LocalDate validateDateOfBirth(LocalDate dob, ZoneId zone) {
        if (dob == null) {
            throw new ValidationException("Date of birth is required.");
        }
        LocalDate today = LocalDate.now(zone == null ? ZoneOffset.UTC : zone);
        if (dob.isAfter(today)) {
            throw new ValidationException("Date of birth cannot be in the future.");
        }
        if (dob.isBefore(today.minusYears(130))) {
            throw new ValidationException("Date of birth is outside a realistic range.");
        }
        return dob;
    }

    public static LocalTime validateTime24h(String timeStr, String fieldName) {
        String clean = requireNonBlank(timeStr, fieldName);
        try {
            return LocalTime.parse(clean, TIME_24H);
        } catch (DateTimeParseException ex) {
            throw new ValidationException(fieldName + " must be in 24-hour HH:mm format (e.g., 14:30).");
        }
    }

    public static String validateBloodGroup(String value) {
        String clean = optionalTrimmed(value);
        if (clean.isEmpty()) {
            return "Unknown";
        }
        if (!VALID_BLOOD_GROUPS.contains(clean)) {
            throw new ValidationException("Invalid blood group selected.");
        }
        return clean;
    }

    public static BigDecimal validateNonNegativeAmount(BigDecimal amount, String fieldName) {
        if (amount == null) {
            throw new ValidationException(fieldName + " is required.");
        }
        if (amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new ValidationException(fieldName + " cannot be negative.");
        }
        return amount;
    }

    public static BigDecimal validatePositiveAmount(BigDecimal amount, String fieldName) {
        if (amount == null) {
            throw new ValidationException(fieldName + " is required.");
        }
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ValidationException(fieldName + " must be greater than zero.");
        }
        return amount;
    }

    public static String formatCurrency(BigDecimal amount) {
        return formatCurrency(amount, "₹");
    }

    public static String formatCurrency(BigDecimal amount, String currencySymbol) {
        BigDecimal safe = (amount == null ? BigDecimal.ZERO : amount).setScale(2, RoundingMode.HALF_UP);
        NumberFormat fmt = NumberFormat.getNumberInstance(Locale.US);
        fmt.setMinimumFractionDigits(2);
        fmt.setMaximumFractionDigits(2);
        String symbol = (currencySymbol == null || currencySymbol.trim().isEmpty())
                ? "₹"
                : currencySymbol.trim();
        return symbol + fmt.format(safe);
    }

    public static String sanitizeCsvField(String raw) {
        String s = raw == null ? "" : raw;
        if (!s.isEmpty()) {
            char first = s.charAt(0);
            if (first == '=' || first == '+' || first == '-' || first == '@') {
                s = "'" + s;
            }
        }
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}
