'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AnimatedLogo } from './animated-logo';
import { StreamingMessage } from './streaming-message';
import { StreamingText, ProgressiveText } from './streaming-text';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

/**
 * Demo component showcasing all ContentPort-inspired chat animations
 * This demonstrates the enhanced UX patterns we've implemented
 */
export function ChatAnimationsDemo() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [demoText, setDemoText] = useState('');

  const sampleTexts = [
    "This is a demonstration of our enhanced streaming text animation, inspired by ContentPort's smooth typewriter effect.",
    "The o4-mini model with medium reasoning effort provides enhanced analytical capabilities while maintaining optimal response speed.",
    "Our implementation includes smooth enter/exit animations, progressive loading states, and intelligent streaming detection."
  ];

  const handleStartDemo = () => {
    const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
    setDemoText(randomText);
    setIsStreaming(true);
    
    // Auto-stop streaming after text completion
    setTimeout(() => {
      setIsStreaming(false);
    }, randomText.length * 8 + 1000);
  };

  const handleThinkingDemo = () => {
    setIsThinking(true);
    setTimeout(() => {
      setIsThinking(false);
      setDemoText("After progressive thinking stages, here's the final response with enhanced reasoning capabilities.");
      setIsStreaming(true);
      setTimeout(() => setIsStreaming(false), 3000);
    }, 6000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Enhanced Chat Animations</CardTitle>
          <CardDescription>
            ContentPort-inspired animations with improved UX patterns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Animated Logo Variants */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Animated Loading Indicators</h3>
            <div className="flex items-center gap-8 p-4 bg-muted/50 rounded-lg">
              <div className="text-center space-y-2">
                <AnimatedLogo variant="sparkles" size={32} />
                <p className="text-sm text-muted-foreground">Sparkles</p>
              </div>
              <div className="text-center space-y-2">
                <AnimatedLogo variant="dots" size={32} />
                <p className="text-sm text-muted-foreground">Dots</p>
              </div>
              <div className="text-center space-y-2">
                <AnimatedLogo variant="pulse" size={32} />
                <p className="text-sm text-muted-foreground">Pulse</p>
              </div>
            </div>
          </div>

          {/* Streaming Text Demo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Streaming Text Animation</h3>
            <div className="min-h-32 p-4 bg-muted/50 rounded-lg">
              {demoText && (
                <StreamingMessage
                  content={demoText}
                  isStreaming={isStreaming}
                  speed={8}
                  enableMarkdown={true}
                />
              )}
              {!demoText && (
                <p className="text-muted-foreground italic">
                  Click "Start Streaming Demo" to see the typewriter effect
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleStartDemo} disabled={isStreaming}>
                Start Streaming Demo
              </Button>
              <Button 
                variant="outline" 
                onClick={() => { setDemoText(''); setIsStreaming(false); }}
                disabled={isStreaming}
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Progressive Thinking Demo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Progressive Thinking Animation</h3>
            <div className="min-h-32 p-4 bg-muted/50 rounded-lg">
              {isThinking ? (
                <ProgressiveText
                  content=""
                  isLoading={true}
                  stages={[
                    'Thinking...',
                    'Analyzing your request...',
                    'Processing with o4-mini reasoning...',
                    'Generating response...'
                  ]}
                  stageInterval={1200}
                />
              ) : (
                <p className="text-muted-foreground italic">
                  Click "Start Thinking Demo" to see progressive loading states
                </p>
              )}
            </div>
            <Button onClick={handleThinkingDemo} disabled={isThinking}>
              {isThinking ? 'Thinking...' : 'Start Thinking Demo'}
            </Button>
          </div>

          {/* Message Animation Demo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Message Animations</h3>
            <div className="space-y-4">
              <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  mass: 1,
                }}
                className="flex gap-4 p-4 bg-muted/50 rounded-lg"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
                  <AnimatedLogo size={14} variant="sparkles" />
                </div>
                <div className="flex-1">
                  <StreamingText
                    content="This message appears with smooth spring animation and includes streaming text effects."
                    isLoading={false}
                    enableStreaming={false}
                  />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Performance Notes */}
          <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">
              Performance Optimizations
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Uses requestAnimationFrame for smooth animations</li>
              <li>• Proper cleanup prevents memory leaks</li>
              <li>• Memoized components reduce unnecessary re-renders</li>
              <li>• Conditional streaming based on content significance</li>
              <li>• Spring animations with optimized physics</li>
            </ul>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}