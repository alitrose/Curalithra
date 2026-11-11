package com.curalithra.web.enums;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Fine-grained RBAC matrix matching CURALITHRA domain security policy.
 */
public enum RolePermission {
    VIEW_DASHBOARD,
    VIEW_PATIENTS,
    EDIT_PATIENTS,
    DELETE_PATIENTS,
    VIEW_DOCTORS,
    EDIT_DOCTORS,
    DELETE_DOCTORS,
    VIEW_APPOINTMENTS,
    MANAGE_APPOINTMENTS,
    CANCEL_APPOINTMENTS,
    VIEW_MEDICAL_RECORDS,
    EDIT_MEDICAL_RECORDS,
    VIEW_BILLING,
    MANAGE_BILLING,
    DELETE_BILLING,
    VIEW_REPORTS,
    EXPORT_REPORTS,
    MANAGE_USERS,
    VIEW_ACTIVITY_LOGS,
    MANAGE_SETTINGS;

    private static final Map<Role, Set<RolePermission>> MATRIX = new EnumMap<>(Role.class);

    static {
        MATRIX.put(Role.ADMIN, EnumSet.allOf(RolePermission.class));

        MATRIX.put(Role.DOCTOR, EnumSet.of(
                VIEW_DASHBOARD,
                VIEW_PATIENTS,
                EDIT_PATIENTS,
                VIEW_DOCTORS,
                VIEW_APPOINTMENTS,
                MANAGE_APPOINTMENTS,
                VIEW_MEDICAL_RECORDS,
                EDIT_MEDICAL_RECORDS,
                VIEW_BILLING,
                VIEW_REPORTS,
                EXPORT_REPORTS
        ));

        MATRIX.put(Role.RECEPTIONIST, EnumSet.of(
                VIEW_DASHBOARD,
                VIEW_PATIENTS,
                EDIT_PATIENTS,
                VIEW_DOCTORS,
                VIEW_APPOINTMENTS,
                MANAGE_APPOINTMENTS,
                CANCEL_APPOINTMENTS,
                VIEW_BILLING,
                MANAGE_BILLING,
                VIEW_REPORTS,
                EXPORT_REPORTS
        ));
    }

    public static boolean hasPermission(Role role, RolePermission permission) {
        if (role == null || permission == null) {
            return false;
        }
        Set<RolePermission> perms = MATRIX.get(role);
        return perms != null && perms.contains(permission);
    }

    public static Set<RolePermission> permissionsFor(Role role) {
        if (role == null) {
            return EnumSet.noneOf(RolePermission.class);
        }
        Set<RolePermission> perms = MATRIX.get(role);
        return perms == null ? EnumSet.noneOf(RolePermission.class) : EnumSet.copyOf(perms);
    }
}
