import { EigenDAAdapter } from '@layr-labs/agentkit-eigenda';
// @ts-ignore
import { OpacityAdapter } from '@layr-labs/agentkit-opacity';
import dotenv from 'dotenv';

dotenv.config();

export interface VerifiableResponse {
  content: string;
  proof: any;
}

const systemPrompt = `
You are a helpful and efficient assistant that facilitates transactions and social connections. You receive input from the user, including a recipient wallet address, a Telegram username, and a LinkedIn username. Based on this input, you can perform the following actions:

Send Transactions: Call sendTransaction(recipientAddress, amount, ticker) to send cryptocurrency to the specified wallet address. Ensure that amount is a positive number and ticker is a valid cryptocurrency symbol (e.g., ETH, USDT).
Connect on Telegram: Call connectOnTelegram(telegramUsername) to initiate a connection with the given Telegram username.
Connect on LinkedIn: Call connectOnLinkedin(linkedinUsername) to initiate a connection request with the specified LinkedIn username.

Respond in the following JSON format:
{
    "text": "string // AI agent response",
    "functionCall": {
      "functionName": "string // Relevant function name, if applicable",
      "args": { "string": "string // Key-value pairs of arguments" }
    }
  }
`

export class Agent {
  private opacity: OpacityAdapter;
  private eigenDA: EigenDAAdapter;

  constructor() {
    // Initialize Opacity adapter for verifiable AI inference
    this.opacity = new OpacityAdapter({
      apiKey: process.env.OPACITY_OPENAI_KEY!,
      teamId: process.env.OPACITY_TEAM_ID!,
      teamName: process.env.OPACITY_TEAM_NAME!,
      opacityProverUrl: process.env.OPACITY_PROVER_URL!,
    });

    // Initialize EigenDA adapter for data availability logging
    this.eigenDA = new EigenDAAdapter({
      privateKey: process.env.EIGENDA_PRIVATE_KEY!,
      apiUrl: process.env.EIGENDA_API_URL!,
      rpcUrl: process.env.EIGENDA_BASE_RPC_URL!,
      creditsContractAddress: process.env.EIGENDA_CREDITS_CONTRACT!,
      flushInterval: 5000, // Flush logs every 5 seconds
      maxBufferSize: 100, // Maximum number of logs to buffer
    });
  }

  /**
   * Initialize all adapters
   */
  async initialize() {
    try {
      console.log('Initializing Opacity adapter...');
      await this.opacity.initialize();

      console.log('Initializing EigenDA adapter...');
      await this.eigenDA.initialize();
      
      console.log('All adapters initialized successfully');
    } catch (error) {
      console.error('Error initializing adapters:', error);
      throw error;
    }
  }

  /**
   * Generate verifiable text using Opacity and log to EigenDA
   */
  async generateVerifiableText(prompt: string): Promise<VerifiableResponse> {
    try {
      console.log('Generating text with prompt:', prompt);
      // Generate text with proof using Opacity
      const result = await this.opacity.generateText(
        systemPrompt + ". User Query: " + 
        prompt
      );

      // Extract JSON from markdown code block and parse it
      const content = result.content;
      const jsonString = content.replace(/```json\n|\n```/g, '').trim();
      const jsonResult = JSON.parse(jsonString);
      
      console.log('Parsed JSON result:', jsonResult);

      // Log the generation to EigenDA
      await this.eigenDA.info('Text Generation', {
        prompt,
        result: result.content,
        hasProof: !!result.proof,
      });

      return {
        content: jsonResult,
        proof: result.proof
      };
    } catch (error) {
      console.error('Error in generateVerifiableText:', error);
      throw error;
    }
  }

  /**
   * Utility method to log information directly to EigenDA
   */
  async logInfo(message: string, metadata: any): Promise<void> {
    await this.eigenDA.info(message, metadata);
  }
}

// Export a factory function to create new agent instances
export const createAgent = async (): Promise<Agent> => {
  const agent = new Agent();
  await agent.initialize();
  return agent;
}; 