/**
 * Motion tokens ported from the prototype — one spring family so the
 * product feels physically consistent.
 */
import type { Transition } from "motion/react";

export const spring: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 26,
  mass: 1,
};

export const springFast: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 28,
};

export const springSlow: Transition = {
  type: "spring",
  stiffness: 140,
  damping: 24,
};
