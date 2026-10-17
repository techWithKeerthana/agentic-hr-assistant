import asyncio
from playwright.async_api import async_playwright

async def take_screenshot():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=300)
        page = await browser.new_page()
        await page.set_viewport_size({"width": 1280, "height": 900})
        await page.goto("http://localhost:5173")
        await page.wait_for_selector("textarea", timeout=10000)
        
        # Click New Conversation button to start fresh
        btn = await page.query_selector('button:has-text("New Conversation")')
        if btn:
            await btn.click()
            await page.wait_for_timeout(1000)
        
        async def wait_enabled(timeout=90000):
            await page.wait_for_function(
                "() => { const t = document.querySelector('textarea'); return t && !t.disabled; }",
                timeout=timeout
            )
            await page.wait_for_timeout(500)
        
        async def send(text):
            await wait_enabled()
            await page.fill("textarea", text)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(1000)
            await wait_enabled(timeout=90000)
        
        await send("I want to book an appointment with HR")
        await send("Sarah Johnson")
        await send("sarah.johnson@company.com")
        # Extra wait for BookingCard to render
        await page.wait_for_timeout(3000)
        
        await page.screenshot(path="C:/Intelligent/agentic-hr-assistant/final_booking_screenshot.png", full_page=False)
        print("Screenshot saved with booking card")
        await browser.close()

asyncio.run(take_screenshot())
