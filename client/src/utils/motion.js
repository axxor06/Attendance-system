// Centralised Framer Motion variants.
// Use as: <motion.div {...fadeUp}> or <motion.div variants={staggerItem}>

export const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: 0.22 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95, y: -6 },
  animate: { opacity: 1, scale: 1,    y: 0  },
  exit:    { opacity: 0, scale: 0.96, y: -4 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
};

export const slideInLeft = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0   },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
};

export const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0  },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
};

export const pageTransition = {
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0  },
  exit:       { opacity: 0, y: -6 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
};
