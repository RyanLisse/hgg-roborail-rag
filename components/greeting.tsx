import { motion } from 'framer-motion';

export const Greeting = () => {
  return (
    <div
      className="mx-auto flex size-full max-w-3xl flex-col justify-center px-8 md:mt-20"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="font-semibold text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        Welcome to RoboRail Assistant!
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl text-zinc-500"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        Ask me anything about RoboRail systems, calibration, safety, or
        operations.
      </motion.div>
    </div>
  );
};
