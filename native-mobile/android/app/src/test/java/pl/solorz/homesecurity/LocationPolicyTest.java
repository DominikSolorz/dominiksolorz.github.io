package pl.solorz.homesecurity;

import org.junit.Test;
import static org.junit.Assert.*;

public class LocationPolicyTest {
    private final String page = NavigationPolicy.view("home");
    @Test public void onlyOwnerOriginMayAskFromAnActivePanel() {
        assertTrue(LocationPolicy.allowed(NavigationPolicy.ORIGIN, page));
        assertTrue(LocationPolicy.allowed(NavigationPolicy.ORIGIN+":443/", page));
        for (String origin : new String[]{null, "http://dominiksolorz.github.io", "https://dominiksolorz.github.io.attacker.example",
                "https://dominiksolorz.github.io@attacker.example", "https://attacker@dominiksolorz.github.io",
                NavigationPolicy.ORIGIN+":444", NavigationPolicy.ORIGIN+"/kamera/", NavigationPolicy.ORIGIN+"?q=1",
                NavigationPolicy.ORIGIN+"#fragment", "file:///kamera/"})
            assertFalse(String.valueOf(origin), LocationPolicy.allowed(origin, page));
        for (String inactive : new String[]{null, "", NavigationPolicy.ORIGIN+"/", "https://attacker.example/kamera/"})
            assertFalse(LocationPolicy.allowed(NavigationPolicy.ORIGIN, inactive));
    }
}
