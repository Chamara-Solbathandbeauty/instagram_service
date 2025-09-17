import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

@Injectable()
export class LLMService implements OnModuleInit {
  private llm: ChatGoogleGenerativeAI;

  async onModuleInit() {
    // Ensure environment variables are loaded
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      console.error('GOOGLE_API_KEY not found in environment variables');
      throw new Error('GOOGLE_API_KEY environment variable is required');
    }

    // Initialize Google Generative AI model once
    this.llm = new ChatGoogleGenerativeAI({
      model: process.env.GOOGLE_GENAI_MODEL || 'gemini-2.5-flash',
      temperature: 0.7,
      apiKey: apiKey,
    });

    console.log('LLMService initialized successfully with model:', process.env.GOOGLE_GENAI_MODEL || 'gemini-2.5-flash');
  }

  getLLM(): ChatGoogleGenerativeAI {
    if (!this.llm) {
      throw new Error('LLM not initialized. Make sure LLMService is properly configured.');
    }
    return this.llm;
  }

  // Method to get LLM with custom temperature for content generation
  getContentLLM(): ChatGoogleGenerativeAI {
    if (!this.llm) {
      throw new Error('LLM not initialized. Make sure LLMService is properly configured.');
    }
    // Return the same instance but with different temperature if needed
    return this.llm;
  }
}
