# Main Goal
Web application, viewable on computer or smart phone.
Supabase Database backend.
Minimum cloud infrastructure needed to successfully run. Options include AWS or cloudflare.
Suggested UI framework react.
Suggest using pnpm instead of npm for security.
Use developer best practices. 

# Functionality
This is an application to track user's merchandise. 
Users are collaborative, sharing merchandise with other users.
Allows multiple users to login.
Users can create "teams" AKA friend groups of other users.
Users can post upcoming sales trips and others users can request the traveling user sell their item at the trip.
Both users need to approve that loan of the items, the sales cost and the commision for the seller. Upon returning the seller needs to tell the loaner where to meet up for exchange of funds and unsold merchandise.
Users need to be able to create multiple trips, have multiple types of items in their inventory.
Users should be able to search other users by name (but not see each other inventory).

# Example
User "Ann" logs in.
Ann creates an upcoming trip event "Going to Tradeshow in DC on Oct 5th". She provides a pre-trip pickup time and location "local makerspace 1234 Dr. Leesburg on Oct 4th 3pm". System needs to demand an example time stamp down to the minute so time and location would be separate fields.
Ann also needs to specify a return time location, she chooses the default value which is the same as her pickup location "local makerspace 1234 Dr. Leesburg" return time "Oct 6th 3pm".
The system also allows for a note, so she could say "Have to get gas on the way back so may be late to return".

User "Bob" logs in to his own account.
Since "Ann" is a member of his team he can see her trip in his list of "Team Trips".
"Bob" has 20 robot dogs. He sends an order to "Ann" to sell "10" of his robot dogs on her trip for "$50.00" each for a commision of "$5.00" for each dog sold. 
"Ann" can either approve this or request "Bob" make a change. "Bob" would get a message related to this particular order if "Ann" requested a change or if she approved, if she requested a change he'd have to approve it. Basically each time any user requests or changes the nature of an order the other party needs to be informed and needs to approve it.
After the trip was over Ann would update the order for Bob. 5 sold in this example.
When Ann returns she gives Bob any earnings after commisions $225 (250 - 25 commision), along with any unsold inventory (5 remaining).
Bob approves that he received the inventory and his inventory of robot dogs is updated to be 15 (20 - 5).

# Scale
For the first few months we are expecting somewhere between 10 - 50 users.
We are expecting them to have anywhere from 1 - 100 different types of items.
Of these item types we are expecting their inventory to be no more than 10,000 of any item (don't make that the max allowed size but just FYI)
Users really won't have more than 100 trips a year, and probably it will be more like 5-10.
