export const validators = {
  required: (label = "This field") => ({
    required: `${label} is required`,
  }),

  email: {
    required: "Email is required",
    pattern: {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: "Enter a valid email address",
    },
  },

  phone: {
    required: "Phone number is required",
    pattern: {
      value: /^[6-9]\d{9}$/,
      message: "Enter a valid 10-digit Indian mobile number",
    },
  },

  password: {
    required: "Password is required",
    minLength: {
      value: 8,
      message: "Password must be at least 8 characters",
    },
  },
};
