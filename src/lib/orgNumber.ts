// Swedish organization number validation and formatting
import { data } from "@/data";
import type { CompanyInfo } from "@/data/types";

export const formatOrgNumber = (input: string): string => {
  // Remove all non-digits
  const digits = input.replace(/\D/g, '');
  
  // Format as XXXXXX-XXXX
  if (digits.length > 6) {
    return `${digits.slice(0, 6)}-${digits.slice(6, 10)}`;
  }
  return digits;
};

export const validateOrgNumber = (orgNumber: string): boolean => {
  // Remove formatting
  const digits = orgNumber.replace(/\D/g, '');
  
  // Must be exactly 10 digits
  if (digits.length !== 10) {
    return false;
  }
  
  // Luhn algorithm checksum validation
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = parseInt(digits[i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  return sum % 10 === 0;
};

export type { CompanyInfo };

export const lookupCompany = async (orgNumber: string): Promise<CompanyInfo | null> => {
  if (!validateOrgNumber(orgNumber)) return null;
  return data.companyLookup.lookup(orgNumber);
};
