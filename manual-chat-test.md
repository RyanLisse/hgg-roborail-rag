# Manual Chat and Model Testing Guide

## ✅ Comprehensive Chat System Verification

This guide provides step-by-step instructions to manually test all chat functionality and model providers.

### Prerequisites Check

1. **✅ Development Server Running**
   ```bash
   pnpm dev
   # Should show: Ready in ~2s at http://localhost:3000
   ```

2. **✅ Services Status**
   ```bash
   curl -s http://localhost:3000/api/health | jq
   # Should show all services as "connected" or "configured"
   ```

3. **✅ Vector Store Sources**
   ```bash
   curl -s http://localhost:3000/api/vectorstore/sources | jq
   # Should show available sources: ["openai", "memory"]
   ```

---

## 🧪 Test Plan

### Test 1: Basic Chat Functionality
**Objective**: Verify chat interface loads and basic messaging works

1. Open http://localhost:3000
2. Wait for page to load completely
3. Verify you see:
   - Message input field at bottom
   - Model selector dropdown (default: GPT-4.1)
   - Vector store selector
   - Send button (should be enabled when typing)

4. **Send Test Message**: "Hello! Can you tell me what 2+2 equals?"
5. **Expected**: 
   - Message appears in chat
   - Assistant responds with "4" or explanation
   - No error messages
   - URL changes to `/chat/[uuid]`

**✅ PASS** / **❌ FAIL**: ______

---

### Test 2: OpenAI Models
**Objective**: Test all OpenAI model variants

**Model 1: GPT-4.1 (Default)**
1. Select "GPT-4.1" from model dropdown
2. Send: "What is artificial intelligence? Respond in one sentence."
3. **Expected**: Comprehensive response about AI

**✅ PASS** / **❌ FAIL**: ______

**Model 2: GPT-4.1 Mini**
1. Select "GPT-4.1 Mini" from model dropdown  
2. Send: "What is machine learning? Respond in one sentence."
3. **Expected**: Response about machine learning, possibly faster

**✅ PASS** / **❌ FAIL**: ______

---

### Test 3: Anthropic Models
**Objective**: Test Claude model variants

**Model 1: Claude 4 Sonnet**
1. Select "Claude 4 Sonnet" from model dropdown
2. Send: "What is deep learning? Respond in one sentence."
3. **Expected**: Response about deep learning

**✅ PASS** / **❌ FAIL**: ______

**Model 2: Claude 4 Opus**
1. Select "Claude 4 Opus" from model dropdown
2. Send: "What is natural language processing? Respond in one sentence."  
3. **Expected**: Response about NLP

**✅ PASS** / **❌ FAIL**: ______

---

### Test 4: Google Models
**Objective**: Test Gemini model variants

**Model 1: Gemini 1.5 Pro Latest**
1. Select "Gemini 1.5 Pro Latest" from model dropdown
2. Send: "What is computer vision? Respond in one sentence."
3. **Expected**: Response about computer vision

**✅ PASS** / **❌ FAIL**: ______

**Model 2: Gemini 1.5 Flash Latest**
1. Select "Gemini 1.5 Flash Latest" from model dropdown
2. Send: "What is robotics? Respond in one sentence."
3. **Expected**: Response about robotics, possibly faster

**✅ PASS** / **❌ FAIL**: ______

---

### Test 5: Vector Store Integration
**Objective**: Verify RAG functionality works

1. **Configure Vector Sources**:
   - Click database selector
   - Enable "memory" and "openai" sources
   - Should show both selected

2. **Send RAG Query**: "What technical documentation or code examples do you have in your knowledge base?"

3. **Expected**:
   - Response references available documentation
   - Citations/sources shown (if any)
   - Response indicates knowledge base search

**✅ PASS** / **❌ FAIL**: ______

---

### Test 6: Tool Usage
**Objective**: Verify AI can use external tools

1. **Weather Tool Test**:
   - Send: "What's the current weather in San Francisco?"
   - **Expected**: Response with weather data or tool usage indicator

**✅ PASS** / **❌ FAIL**: ______

2. **Follow-up Question**:
   - Send: "Can you elaborate on that weather forecast?"
   - **Expected**: Detailed follow-up response

**✅ PASS** / **❌ FAIL**: ______

---

### Test 7: Model Switching Mid-Conversation
**Objective**: Verify seamless model switching

1. **Start with OpenAI**: Select "GPT-4.1 Mini"
   - Send: "What's 5 + 5?"
   - **Expected**: "10"

2. **Switch to Anthropic**: Select "Claude 4 Sonnet"  
   - Send: "What's 7 + 7?"
   - **Expected**: "14"

3. **Switch to Google**: Select "Gemini 1.5 Flash Latest"
   - Send: "What's 9 + 9?"
   - **Expected**: "18"

4. **Verify conversation history preserved**: All previous messages should remain visible

**✅ PASS** / **❌ FAIL**: ______

---

### Test 8: Error Handling
**Objective**: Verify graceful error handling

1. **Send potentially problematic request**:
   - Use any model
   - Send: Very long message (1000+ characters)
   - **Expected**: Either proper response or clear error message

2. **Network error simulation**:
   - Disconnect internet briefly
   - Send message
   - **Expected**: Error message displayed, no crash

**✅ PASS** / **❌ FAIL**: ______

---

### Test 9: Performance
**Objective**: Verify acceptable response times

1. **Fast Model Test**: Use "GPT-4.1 Mini"
   - Send: "Hi there!"
   - **Expected**: Response within 10 seconds

2. **Complex Query Test**: Use any model
   - Send: "Explain the differences between supervised and unsupervised learning."
   - **Expected**: Response within 30 seconds

**✅ PASS** / **❌ FAIL**: ______

---

### Test 10: File Upload (Optional)
**Objective**: Test file attachment functionality

1. **Click attachment button** (📎)
2. **Upload small image** (if working)
3. **Send message**: "What's in this image?"
4. **Expected**: Analysis of image content OR clear error about blob storage

**✅ PASS** / **❌ FAIL**: ______

---

## 📊 Results Summary

**Total Tests**: 10
**Passed**: ___/10
**Failed**: ___/10

### Key Findings:

**✅ Working Providers**:
- [ ] OpenAI (GPT-4.1, GPT-4.1 Mini)
- [ ] Anthropic (Claude 4 Sonnet, Claude 4 Opus)  
- [ ] Google (Gemini 1.5 Pro Latest, Gemini 1.5 Flash Latest)

**✅ Working Features**:
- [ ] Basic chat functionality
- [ ] Model switching
- [ ] Vector store integration
- [ ] Tool usage (weather)
- [ ] Error handling
- [ ] Performance acceptable

**❌ Issues Found**:
- [ ] None
- [ ] List any issues here...

---

## 🔧 Troubleshooting

**If chat doesn't load**:
1. Check console for errors (F12)
2. Verify dev server is running
3. Check Redis is running: `redis-cli ping`

**If models don't respond**:
1. Check API keys in .env.local
2. Verify model IDs match available models
3. Check network connectivity

**If tests fail**:
1. Note specific error messages
2. Check browser console for details
3. Test with different models

---

## 🎯 Automation Status

- **Playwright E2E Tests**: ⚠️ Currently failing due to worker process issues
- **Manual Testing**: ✅ Comprehensive coverage provided above
- **API Testing**: ✅ Basic endpoints verified
- **Health Checks**: ✅ All services operational

This manual testing approach provides thorough verification until the automated test issues are resolved.