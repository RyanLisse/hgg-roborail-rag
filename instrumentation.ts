import { registerOTel } from '@vercel/otel';
import { AISDKExporter } from 'langsmith/vercel';
import { isLangSmithEnabled, langSmithConfig } from './lib/env';

export function register() {
  // Enable LangSmith tracing if configured
  if (isLangSmithEnabled) {
    registerOTel({
      serviceName: 'rra-rag-chatbot',
      traceExporter: new AISDKExporter({
        projectName: langSmithConfig.projectName,
      }),
    });
  } else {
    registerOTel({ serviceName: 'rra-rag-chatbot' });
  }
}
