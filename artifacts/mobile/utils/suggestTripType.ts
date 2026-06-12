/**
 * Suggests a trip type ("business" | "private") based on current weekday and time.
 *
 * Default rule: Mon–Fri between 07:00 and 18:00 → "business", otherwise "private".
 * All thresholds are configurable via the options parameter.
 */
export interface TripTypeSuggestionOptions {
  businessStartHour?: number;
  businessEndHour?: number;
  businessDays?: number[];
}

export type TripType = "business" | "private" | "arbeitsweg";

export function suggestTripType(
  now: Date = new Date(),
  options: TripTypeSuggestionOptions = {}
): TripType {
  const {
    businessStartHour = 7,
    businessEndHour = 18,
    businessDays = [1, 2, 3, 4, 5],
  } = options;

  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  const isBusinessDay = businessDays.includes(dayOfWeek);
  const isBusinessHour = hour >= businessStartHour && hour < businessEndHour;

  return isBusinessDay && isBusinessHour ? "business" : "private";
}
