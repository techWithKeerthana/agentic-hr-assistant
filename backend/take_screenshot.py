import asyncio
from playwright.async_api import async_playwright

async def take_screenshot():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=200)
        page = await browser.new_page()
        await page.set_viewport_size({"width": 1280, "height": 900})
        await page.goto("http://localhost:5173")
        await page.wait_for_selector("textarea", timeout=10000)
        
        # Start a booking flow
        await page.wait_for_function("() => { const t = document.querySelector('textarea'); return t && !t.disabled; }")
        await page.fill("textarea", "I want to book an appointment with HR")
        await page.keyboard.press("Enter")
        await page.wait_for_function("() => { const t = document.querySelector('textarea'); return t && !t.disabled; }", timeout=60000)
        
        await page.fill("textarea", "Sarah Johnson")
        await page.keyboard.press("Enter")
        await page.wait_for_function("() => { const t = document.querySelector('textarea'); return t && !t.disabled; }", timeout=60000)
        
        await page.fill("textarea", "sarah.johnson@company.com")
        await page.keyboard.press("Enter")
        await page.wait_for_function("() => { const t = document.querySelector('textarea'); return t && !t.disabled; }", timeout=60000)
        await page.wait_for_timeout(2000)
        
        await page.screenshot(path="C:/Intelligent/agentic-hr-assistant/final_booking_screenshot.png", full_page=False)
        print("Screenshot saved")
        await browser.close()

asyncio.run(take_screenshot())
