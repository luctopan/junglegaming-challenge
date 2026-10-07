/** Full turn in radians. */
export const TAU = Math.PI * 2;

export const HALF = 0.5;

/**
 * Tolerance for comparisons of accumulated floating-point quantities (seconds,
 * distances): boundaries such as "elapsed ≥ n × interval" must not flip on the
 * last bit of a product.
 */
export const EPSILON = 1e-9;

export const MS_PER_SECOND = 1000;
