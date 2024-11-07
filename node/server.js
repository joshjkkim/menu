const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());

const diningHallURLs = {
    'south-quad': 'https://dining.umich.edu/menus-locations/dining-halls/south-quad/',
    'east-quad': 'https://dining.umich.edu/menus-locations/dining-halls/east-quad/',
    'markley': 'https://dining.umich.edu/menus-locations/dining-halls/markley/',
    'bursley': 'https://dining.umich.edu/menus-locations/dining-halls/bursley/',
    'mosher-jordan': 'https://dining.umich.edu/menus-locations/dining-halls/mosher-jordan/',
    'north-quad': 'https://dining.umich.edu/menus-locations/dining-halls/north-quad/',
};

async function scrapeMenu(diningHall) {
    const url = diningHallURLs[diningHall];

    if (!url) {
        throw new Error('Invalid dining hall');
    }

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    await page.goto(url);
    
    await page.waitForSelector('.courses_wrapper');

    const menuItems = [];

    const foodItems = await page.$$eval('.courses_wrapper .items li', food => {
        return food.map(item => {
            const foodName = item.querySelector('.item-name') ? item.querySelector('.item-name').textContent.trim() : 'Unknown';
            const traits = Array.from(item.querySelectorAll('.traits li')).map(li => li.textContent.trim());

            const nutritionDiv = item.querySelector('.nutrition');
            let calories = 'N/A'; 
            let contains = []; 
            let sodium = 'N/A'; 
            let cholesterol = 'N/A';
            let sugars = 'N/A'; 
            let protein = 'N/A'; 
            let totalFat = 'N/A'; 

            if (nutritionDiv) {
                const calorieRow = nutritionDiv.querySelector('.portion-calories');
                if (calorieRow) {
                    const calorieText = calorieRow.textContent;
                    const match = calorieText.match(/Calories\s*(\d+)/); 
                    calories = match ? match[1] : 'N/A'; 
                }
                
                const allergensDiv = nutritionDiv.querySelector('.allergens');
                if (allergensDiv) {
                    const allergens = allergensDiv.querySelectorAll('li');
                    contains = Array.from(allergens).map(allergen => allergen.textContent.trim());
                }

                const nutritionalRows = nutritionDiv.querySelectorAll('td'); 

                nutritionalRows.forEach(row => {
                    const nutrientText = row.textContent.trim();
                    const match = nutrientText.match(/(Sodium|Cholesterol|Sugars|Protein|Total Fat)\s*(\d+g?)/);
                    
                    if (match) {
                        const nutrientName = match[1];
                        const nutrientValue = match[2];
                        
                        switch (nutrientName) {
                            case 'Sodium':
                                sodium = nutrientValue; 
                                break;
                            case 'Cholesterol':
                                cholesterol = nutrientValue; 
                                break;
                            case 'Sugars':
                                sugars = nutrientValue; 
                                break;
                            case 'Protein':
                                protein = nutrientValue;
                                break;
                            case 'Total Fat':
                                totalFat = nutrientValue; 
                                break;
                        }
                    }
                });
            }

            if (foodName !== 'Unknown' && traits.length > 0) {
                return { 
                    food: foodName,
                    traits: traits,
                    calories: calories,
                    contains: contains, 
                    sodium: sodium,
                    cholesterol: cholesterol, 
                    sugars: sugars,
                    protein: protein, 
                    totalFat: totalFat 
                };
            }
            return null; 
        }).filter(item => item !== null); 
    });

    menuItems.push(...foodItems);

    console.log('Menu Items:', menuItems); 
    await browser.close();
    return menuItems;
}

app.get('/menu', async (req, res) => {
    const diningHall = req.query.diningHall; 

    try {
        const menuItems = await scrapeMenu(diningHall);
        res.json(menuItems);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching the menu: ' + error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
