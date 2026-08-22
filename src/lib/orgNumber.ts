// Swedish organization number validation and formatting
import type { CompanyLookupPort } from "@/data/ports";
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

/**
 * Slår upp bolaget - men tar emot porten i stället för att hämta den.
 *
 * Förut importerades den konkreta adaptern (`data`) rakt in hit. Det gjorde
 * en annars ren domänmodul beroende av vilken backend som råkade vara
 * inkopplad, och det är precis den kopplingen ports-and-adapters finns för
 * att slippa: modulen ska gå att använda i ett annat verktyg, mot en annan
 * adapter, utan att någonting följer med på köpet.
 */
export const lookupCompany = async (
  orgNumber: string,
  port: CompanyLookupPort,
): Promise<CompanyInfo | null> => {
  if (!validateOrgNumber(orgNumber)) return null;
  return port.lookup(orgNumber);
};
